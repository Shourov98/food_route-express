import { ApplicationError } from '../../core/ApplicationError.js';
import {
  getAuthenticatedAccount,
  requireActiveRoles,
  requireVerifiedAccount,
} from '../../shared/auth/authorization.js';
import { buildPaginationMeta } from '../../shared/pagination.js';
import { parseQrPayload } from '../../shared/utils/qrCode.js';
import { buildCheckInRecordId } from './checkinRepository.js';

const DEFAULT_CHECKIN_RADIUS_METERS = 100;
const MAX_DAILY_CHECKINS = 5;
const CHECKIN_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const MAX_LOCATION_ACCURACY_METERS = 100;
const MAX_LOCATION_AGE_MS = 5 * 60 * 1000;

function sameUtcDate(left, right) {
  return left.toISOString().slice(0, 10) === right.toISOString().slice(0, 10);
}

function checkinResponse(record, { restaurant = null, userBalances = null } = {}) {
  // BR-016: After successful check-in, return enough context that the
  // client can render the confirmation screen AND continue navigating
  // back to the restaurant/profile without a second round-trip.
  const response = {
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

  // Full restaurant payload — lets the client hydrate the restaurant
  // profile screen, show images/hours/menu points, and render the
  // post-check-in modal without re-fetching.
  if (restaurant) {
    response.restaurant = {
      id: restaurant.id,
      name: restaurant.name,
      address: restaurant.address,
      city: restaurant.city,
      country: restaurant.country,
      latitude: restaurant.latitude,
      longitude: restaurant.longitude,
      imageUrl: restaurant.imageUrl ?? null,
      category: restaurant.category ?? null,
      cuisine: restaurant.cuisine ?? null,
      hours: restaurant.hours ?? null,
      phone: restaurant.phone ?? null,
      website: restaurant.website ?? null,
      rating: restaurant.rating ?? null,
      pointsPerCheckIn: restaurant.pointsPerCheckIn ?? 0,
      pointsPerReceiptUpload: restaurant.pointsPerReceiptUpload ?? 0,
      checkinRadiusMeters: restaurant.checkinRadiusMeters ?? null,
      qrRequired: restaurant.qrRequired !== false,
    };
  }

  // Updated balances — saves a /me/summary round-trip on the
  // confirmation screen and prevents stale UI.
  if (userBalances) {
    response.userPointsAfter = userBalances.walletPoints;
    response.userRankingPointsAfter = userBalances.rankingPoints;
  }

  return response;
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

  async scanQr({ accessToken, qrToken, latitude, longitude, accuracy = null, locationCapturedAt = null }) {
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
    if (restaurant.status !== 'active') {
      throw new ApplicationError({
        code: 'restaurant_inactive',
        message: 'Check-in is unavailable because the restaurant is inactive.',
        statusCode: 403,
      });
    }
    // BR-003: per-restaurant QR enforcement. The MVP rule (per product
    // owner) is "GPS AND QR both required" — so we always require a QR
    // token here. The flag is plumbed end-to-end so that future releases
    // can opt a restaurant into GPS-only check-in by toggling `qrRequired`
    // to false in the dashboard.
    const qrRequired = restaurant.qrRequired !== false;
    if (qrRequired && (!qrToken || qrToken.length < 4)) {
      throw new ApplicationError({
        code: 'qr_required',
        message: 'This restaurant requires a QR code scan to check in.',
        statusCode: 400,
      });
    }
    const now = this.nowProvider();
    this.assertFreshAccurateLocation({ accuracy, locationCapturedAt, now });
    this.assertWithinCheckinRange({ restaurant, latitude, longitude });

    await this.assertCheckinAllowed({
      userId: user.uid,
      restaurantId: restaurant.id,
      date: now,
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
    // awardXp is now race-free via firestore.runTransaction. Returns null
    // when a row for this sourceId already exists (concurrent scan, retry,
    // or duplicate card-tap), which we treat as a no-op success.
    const awardedXp = xpRecord?.xpDelta ?? 0;
    let pointsRecord = null;
    if (xpRecord && awardedXp > 0) {
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
      // BR-016: read back the updated wallet + ranking balances so the
      // client can render the confirmation screen without a second
      // round-trip. Fall back to 0 if the reads fail — better than
      // dropping the successful check-in response.
      let userBalances = null;
      try {
        const [walletPoints, rankingPoints] = await Promise.all([
          this.xpService.getTotalPoints(user.uid).catch(() => 0),
          this.xpService.getTotalRankingPoints
            ? this.xpService.getTotalRankingPoints(user.uid).catch(() => 0)
            : Promise.resolve(0),
        ]);
        userBalances = { walletPoints, rankingPoints };
      } catch {
        userBalances = null;
      }
      return {
        data: checkinResponse(created, { restaurant, userBalances }),
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
      const restaurant = await this.restaurantRepository.getByQrToken(qrToken);
      if (!restaurant) {
        throw new ApplicationError({
          code: 'restaurant_qr_not_found',
          message:
            'This QR code is not recognized. Please scan the restaurant check-in QR code again.',
          statusCode: 404,
        });
      }
      return restaurant;
    }

    const token = String(qrPayload.token || '').trim();
    if (!token) {
      throw new ApplicationError({
        code: 'restaurant_qr_invalid',
        message:
          'This QR code is invalid. Please scan the restaurant check-in QR code again.',
        statusCode: 400,
      });
    }
    const restaurant = await this.restaurantRepository.getByQrToken(token);
    if (!restaurant) {
      throw new ApplicationError({
        code: 'restaurant_qr_not_found',
        message:
          'This QR code is not recognized. Please scan the restaurant check-in QR code again.',
        statusCode: 404,
      });
    }
    if (qrPayload.restaurantName !== undefined && String(qrPayload.restaurantName).trim() !== restaurant.name) {
      throw new ApplicationError({
        code: 'restaurant_qr_mismatch',
        message:
          'This QR code does not match this restaurant. Please scan the QR code displayed at the restaurant you are visiting.',
        statusCode: 400,
      });
    }
    if (qrPayload.latitude !== undefined && qrPayload.longitude !== undefined) {
      const encodedLat = Number(qrPayload.latitude);
      const encodedLng = Number(qrPayload.longitude);
      if (Number.isNaN(encodedLat) || Number.isNaN(encodedLng)) {
        throw new ApplicationError({
          code: 'restaurant_qr_invalid',
          message:
            'This QR code is invalid. Please scan the restaurant check-in QR code again.',
          statusCode: 400,
        });
      }
      if (encodedLat !== Number(restaurant.qrCode.location.latitude)) {
        throw new ApplicationError({
          code: 'restaurant_qr_mismatch',
          message:
            'This QR code does not match this restaurant. Please scan the QR code displayed at the restaurant you are visiting.',
          statusCode: 400,
        });
      }
      if (encodedLng !== Number(restaurant.qrCode.location.longitude)) {
        throw new ApplicationError({
          code: 'restaurant_qr_mismatch',
          message:
            'This QR code does not match this restaurant. Please scan the QR code displayed at the restaurant you are visiting.',
          statusCode: 400,
        });
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
    const radiusMeters = Number(
      restaurant.checkinRadiusMeters ??
        restaurant.allowedRadiusMeters ??
        restaurant.radiusMeters ??
        DEFAULT_CHECKIN_RADIUS_METERS,
    );
    const maxDistanceKm = Math.max(10, radiusMeters) / 1000;
    if (!Number.isFinite(distanceKm) || distanceKm > maxDistanceKm) {
      // Surface distance + radius in the error payload so the mobile app can
      // render a precise, contextual message ("you are 350m away, the
      // restaurant allows 100m") instead of a generic "too far" string.
      const distanceMeters = Number.isFinite(distanceKm)
        ? Math.round(distanceKm * 1000)
        : null;
      throw new ApplicationError({
        code: 'checkin_out_of_range',
        message:
          'You are too far from this restaurant to check in. Make sure you are at the restaurant and scanning its QR code.',
        statusCode: 403,
        details: {
          distanceMeters,
          allowedRadiusMeters: Math.max(10, radiusMeters),
          restaurantName: restaurant.name || null,
        },
      });
    }
  }

  assertFreshAccurateLocation({ accuracy, locationCapturedAt, now }) {
    if (accuracy !== null && accuracy !== undefined && accuracy > MAX_LOCATION_ACCURACY_METERS) {
      throw new ApplicationError({
        code: 'checkin_location_inaccurate',
        message: 'Your location accuracy is too low for check-in. Move closer and try again.',
        statusCode: 403,
        details: {
          accuracyMeters: accuracy,
          maxAccuracyMeters: MAX_LOCATION_ACCURACY_METERS,
        },
      });
    }
    if (locationCapturedAt) {
      const ageMs = Math.abs(now.getTime() - locationCapturedAt.getTime());
      if (ageMs > MAX_LOCATION_AGE_MS) {
        throw new ApplicationError({
          code: 'checkin_location_stale',
          message: 'Your location is too old for check-in. Refresh your location and try again.',
          statusCode: 403,
          details: {
            ageSeconds: Math.round(ageMs / 1000),
            maxAgeSeconds: Math.round(MAX_LOCATION_AGE_MS / 1000),
          },
        });
      }
    }
  }

  async assertCheckinAllowed({ userId, restaurantId, date }) {
    const records = await this.checkinRepository.listByUser(userId);
    const recentSameRestaurant = records.find(
      (record) =>
        record.restaurantId === restaurantId &&
        date.getTime() - record.createdAt.getTime() < CHECKIN_COOLDOWN_MS,
    );
    if (recentSameRestaurant) {
      throw new ApplicationError({
        code: 'checkin_cooldown_active',
        message: 'You have already checked in at this restaurant in the last 24 hours.',
        statusCode: 429,
      });
    }

    const dailyCount = records.filter((record) => sameUtcDate(record.createdAt, date)).length;
    if (dailyCount >= MAX_DAILY_CHECKINS) {
      throw new ApplicationError({
        code: 'daily_checkin_limit_reached',
        message: 'You have reached the daily limit of 5 valid check-ins.',
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
