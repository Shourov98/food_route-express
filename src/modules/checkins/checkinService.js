import { ApplicationError } from '../../core/ApplicationError.js';
import {
  getAuthenticatedAccount,
  requireActiveRoles,
  requireVerifiedAccount,
} from '../../shared/auth/authorization.js';
import { buildPaginationMeta } from '../../shared/pagination.js';
import { parseQrPayload } from '../../shared/utils/qrCode.js';
import { buildCheckInRecordId } from './checkinRepository.js';

const CHECKIN_MAX_DISTANCE_KM = 0.1;

function sameUtcDate(left, right) {
  return left.toISOString().slice(0, 10) === right.toISOString().slice(0, 10);
}

function mealWindowForDate(date) {
  const hour = date.getUTCHours();
  if (hour >= 5 && hour < 11) return 'breakfast';
  if (hour >= 11 && hour < 17) return 'lunch';
  if (hour >= 17 && hour < 23) return 'dinner';
  return null;
}

function checkinResponse(record) {
  return {
    id: record.id,
    userId: record.userId,
    userFullname: record.userFullname,
    userEmail: record.userEmail,
    restaurantId: record.restaurantId,
    restaurantName: record.restaurantName,
    restaurantAddress: record.restaurantAddress,
    qrToken: record.qrToken,
    awardedXp: record.awardedXp,
    awardedPoints: record.awardedPoints,
    createdAt: record.createdAt,
  };
}

export class CheckInService {
  constructor({
    checkinRepository,
    restaurantRepository,
    userRepository,
    identityProvider,
    xpService,
    nowProvider = () => new Date(),
  }) {
    this.checkinRepository = checkinRepository;
    this.restaurantRepository = restaurantRepository;
    this.userRepository = userRepository;
    this.identityProvider = identityProvider;
    this.xpService = xpService;
    this.nowProvider = nowProvider;
  }

  async scanQr({ accessToken, qrToken, latitude, longitude }) {
    let user = await getAuthenticatedAccount({
      accessToken,
      identityProvider: this.identityProvider,
      userRepository: this.userRepository,
      notFoundCode: 'user_not_found',
      notFoundMessage: 'No end-user account found for the provided credentials.',
      notFoundStatusCode: 404,
    });
    user = requireActiveRoles({
      record: user,
      allowedRoles: new Set(['user']),
      roleErrorCode: 'user_not_found',
      roleErrorMessage: 'No end-user account found for the provided credentials.',
      roleErrorStatusCode: 404,
      blockedErrorCode: 'user_blocked',
      blockedErrorMessage: 'The user account is blocked.',
    });
    user = requireVerifiedAccount({
      record: user,
      errorCode: 'user_not_verified',
      errorMessage: 'The user account is not verified yet.',
    });

    const qrPayload = parseQrPayload(qrToken);
    const restaurant = await this.resolveRestaurant({ qrToken, qrPayload });
    if (!restaurant) {
      throw new ApplicationError({
        code: 'restaurant_qr_not_found',
        message: 'No restaurant found for the provided QR code.',
        statusCode: 404,
      });
    }
    if (restaurant.status !== 'active') {
      throw new ApplicationError({
        code: 'restaurant_inactive',
        message: 'Check-in is unavailable because the restaurant is inactive.',
        statusCode: 403,
      });
    }
    this.assertWithinCheckinRange({ restaurant, latitude, longitude });

    const now = this.nowProvider();
    const mealWindow = mealWindowForDate(now);
    if (!mealWindow) {
      throw new ApplicationError({
        code: 'checkin_outside_meal_window',
        message: 'Check-in is only available during breakfast, lunch, or dinner hours.',
        statusCode: 403,
      });
    }
    await this.assertMealWindowCheckinAllowed({
      userId: user.uid,
      restaurantId: restaurant.id,
      date: now,
      mealWindow,
    });
    const checkInId = buildCheckInRecordId();
    const xpRecord = await this.xpService.awardXp({
      userId: user.uid,
      delta: restaurant.pointsPerCheckIn,
      sourceType: 'check_in',
      sourceId: checkInId,
      city: user.city || '',
      country: user.country || '',
    });
    const awardedXp = xpRecord?.xpDelta ?? 0;
    let pointsRecord = null;
    if (awardedXp > 0) {
      pointsRecord = await this.xpService.awardPoints({
        userId: user.uid,
        delta: awardedXp,
        sourceType: 'check_in',
        sourceId: checkInId,
        city: user.city || '',
        country: user.country || '',
      });
      if (!pointsRecord) {
        await this.xpService.deleteXpRecord(xpRecord.id);
        throw new ApplicationError({
          code: 'checkin_failed',
          message: 'The check-in could not be completed right now.',
          statusCode: 500,
        });
      }
    }

    const record = {
      id: checkInId,
      userId: user.uid,
      userFullname: user.fullname,
      userEmail: user.email,
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      restaurantAddress: restaurant.address,
      qrToken: restaurant.qrCode.token,
      awardedXp,
      awardedPoints: awardedXp,
      createdAt: now,
    };

    try {
      const created = await this.checkinRepository.create(record);
      return {
        data: checkinResponse(created),
        message: 'Check-in completed successfully.',
      };
    } catch (error) {
      if (xpRecord) {
        await this.xpService.deleteXpRecord(xpRecord.id);
      }
      if (pointsRecord) {
        await this.xpService.deletePointsRecord(pointsRecord.id);
      }
      throw error;
    }
  }

  async listAdminCheckins({ accessToken, page, pageSize }) {
    await this.getCurrentAdmin(accessToken);
    return this.listCheckins(await this.checkinRepository.listAll(), { page, pageSize });
  }

  async listUserCheckins({ accessToken, page, pageSize }) {
    const user = await this.getCurrentUser(accessToken);
    return this.listCheckins(await this.checkinRepository.listByUser(user.uid), {
      page,
      pageSize,
    });
  }

  listCheckins(records, { page, pageSize }) {
    const totalItems = records.length;
    const start = (page - 1) * pageSize;
    return {
      items: records.slice(start, start + pageSize).map(checkinResponse),
      pagination: buildPaginationMeta({ page, pageSize, totalItems }),
    };
  }

  async resolveRestaurant({ qrToken, qrPayload }) {
    if (!qrPayload) {
      return this.restaurantRepository.getByQrToken(qrToken);
    }

    const token = String(qrPayload.token || '').trim();
    const restaurant = token ? await this.restaurantRepository.getByQrToken(token) : null;
    if (!restaurant) {
      return null;
    }
    if (qrPayload.restaurantName !== undefined && String(qrPayload.restaurantName).trim() !== restaurant.name) {
      return null;
    }
    if (qrPayload.latitude !== undefined && qrPayload.longitude !== undefined) {
      const encodedLat = Number(qrPayload.latitude);
      const encodedLng = Number(qrPayload.longitude);
      if (Number.isNaN(encodedLat) || Number.isNaN(encodedLng)) {
        return null;
      }
      if (encodedLat !== Number(restaurant.qrCode.location.latitude)) {
        return null;
      }
      if (encodedLng !== Number(restaurant.qrCode.location.longitude)) {
        return null;
      }
    }
    return restaurant;
  }

  assertWithinCheckinRange({ restaurant, latitude, longitude }) {
    const qrLocation = restaurant.qrCode?.location;
    if (!qrLocation) {
      throw new ApplicationError({
        code: 'restaurant_qr_location_missing',
        message: 'Check-in is unavailable because the restaurant QR location is not configured.',
        statusCode: 500,
      });
    }

    const distanceKm = this.distanceKm(
      latitude,
      longitude,
      Number(qrLocation.latitude),
      Number(qrLocation.longitude),
    );
    if (!Number.isFinite(distanceKm) || distanceKm > CHECKIN_MAX_DISTANCE_KM) {
      throw new ApplicationError({
        code: 'checkin_out_of_range',
        message: 'You must be near the restaurant to check in.',
        statusCode: 403,
      });
    }
  }

  async assertMealWindowCheckinAllowed({ userId, restaurantId, date, mealWindow }) {
    const existing = (await this.checkinRepository.listByUser(userId)).find(
      (record) =>
        record.restaurantId === restaurantId &&
        sameUtcDate(record.createdAt, date) &&
        mealWindowForDate(record.createdAt) === mealWindow,
    );
    if (existing) {
      throw new ApplicationError({
        code: 'checkin_meal_window_limit_reached',
        message: `You have already checked in for ${mealWindow} at this restaurant today.`,
        statusCode: 429,
      });
    }
  }

  distanceKm(latitude, longitude, targetLatitude, targetLongitude) {
    const radiusKm = 6371;
    const lat1 = (latitude * Math.PI) / 180;
    const lon1 = (longitude * Math.PI) / 180;
    const lat2 = (targetLatitude * Math.PI) / 180;
    const lon2 = (targetLongitude * Math.PI) / 180;
    const deltaLat = lat2 - lat1;
    const deltaLon = lon2 - lon1;
    const a =
      Math.sin(deltaLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return radiusKm * c;
  }

  async getCurrentAdmin(accessToken) {
    const record = await getAuthenticatedAccount({
      accessToken,
      identityProvider: this.identityProvider,
      userRepository: this.userRepository,
      notFoundCode: 'admin_not_found',
      notFoundMessage: 'No admin account found for the provided credentials.',
      notFoundStatusCode: 403,
    });
    return requireActiveRoles({
      record,
      allowedRoles: new Set(['admin', 'super_admin']),
      roleErrorCode: 'admin_not_found',
      roleErrorMessage: 'No admin account found for the provided credentials.',
      blockedErrorCode: 'admin_blocked',
      blockedErrorMessage: 'The admin account is blocked.',
    });
  }

  async getCurrentUser(accessToken) {
    const record = await getAuthenticatedAccount({
      accessToken,
      identityProvider: this.identityProvider,
      userRepository: this.userRepository,
      notFoundCode: 'user_not_found',
      notFoundMessage: 'No end-user account found for the provided credentials.',
      notFoundStatusCode: 404,
    });
    return requireActiveRoles({
      record,
      allowedRoles: new Set(['user']),
      roleErrorCode: 'user_not_found',
      roleErrorMessage: 'No end-user account found for the provided credentials.',
      roleErrorStatusCode: 404,
      blockedErrorCode: 'user_blocked',
      blockedErrorMessage: 'The user account is blocked.',
    });
  }
}
