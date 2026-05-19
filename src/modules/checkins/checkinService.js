import { ApplicationError } from '../../core/ApplicationError.js';
import {
  getAuthenticatedAccount,
  requireActiveRoles,
  requireVerifiedAccount,
} from '../../shared/auth/authorization.js';
import { buildPaginationMeta } from '../../shared/pagination.js';
import { parseQrPayload } from '../../shared/utils/qrCode.js';
import { buildCheckInRecordId } from './checkinRepository.js';

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

function sameUtcDate(left, right) {
  return left.toISOString().slice(0, 10) === right.toISOString().slice(0, 10);
}

export class CheckInService {
  constructor({
    checkinRepository,
    restaurantRepository,
    userRepository,
    identityProvider,
    xpService,
  }) {
    this.checkinRepository = checkinRepository;
    this.restaurantRepository = restaurantRepository;
    this.userRepository = userRepository;
    this.identityProvider = identityProvider;
    this.xpService = xpService;
  }

  async scanQr({ accessToken, qrToken }) {
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

    const now = new Date();
    const recentSameRestaurant = await this.checkinRepository.getRecentByUserAndRestaurant({
      userId: user.uid,
      restaurantId: restaurant.id,
    });
    if (recentSameRestaurant && sameUtcDate(recentSameRestaurant.createdAt, now)) {
      return {
        data: checkinResponse(recentSameRestaurant),
        message: 'Checkin awarded with points already.',
      };
    }

    const recent = await this.checkinRepository.getRecentByUser(user.uid);
    if (recent && sameUtcDate(recent.createdAt, now)) {
      throw new ApplicationError({
        code: 'checkin_daily_limit_reached',
        message: 'You have already checked in today. Please try again tomorrow.',
        statusCode: 429,
      });
    }

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
