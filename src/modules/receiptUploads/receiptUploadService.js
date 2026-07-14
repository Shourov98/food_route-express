import { ApplicationError } from '../../core/ApplicationError.js';
import { randomUUID } from 'node:crypto';
import {
  getAuthenticatedAccount,
  requireActiveRoles,
  requireVerifiedAccount,
} from '../../shared/auth/authorization.js';
import { buildReceiptUploadRecordId } from './receiptUploadRepository.js';

const ROUTE_REPEAT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

function receiptUploadResponse(record) {
  return {
    id: record.id,
    checkinId: record.checkinId,
    restaurantId: record.restaurantId,
    restaurantName: record.restaurantName,
    receiptImageUrl: record.receiptImageUrl,
    imageUrl: record.receiptImageUrl,
    note: record.note ?? '',
    status: record.status ?? 'Pending',
    awardedXp: record.awardedXp,
    awardedPoints: record.awardedPoints,
    createdAt: record.createdAt,
    routeProgress: record.routeProgress ?? [],
  };
}

export class ReceiptUploadService {
  constructor({
    receiptUploadRepository,
    checkinRepository,
    restaurantRepository,
    routeRepository = null,
    routeProgressRepository = null,
    userRepository,
    identityProvider,
    imageStorage,
    xpService,
    nowProvider = () => new Date(),
  }) {
    this.receiptUploadRepository = receiptUploadRepository;
    this.checkinRepository = checkinRepository;
    this.restaurantRepository = restaurantRepository;
    this.routeRepository = routeRepository;
    this.routeProgressRepository = routeProgressRepository;
    this.userRepository = userRepository;
    this.identityProvider = identityProvider;
    this.imageStorage = imageStorage;
    this.xpService = xpService;
    this.nowProvider = nowProvider;
  }

  async uploadReceipt({ accessToken, restaurantId, image, note = '' }) {
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

    const restaurant = await this.restaurantRepository.getById(restaurantId);
    if (!restaurant) {
      throw new ApplicationError({
        code: 'restaurant_not_found',
        message: 'No restaurant found for the provided identifier.',
        statusCode: 404,
      });
    }
    const checkin = await this.resolveLatestEligibleCheckin({
      userId: user.uid,
      restaurantId: restaurant.id,
    });
    const now = this.nowProvider();
    const eligibleRoutes = await this.resolveEligibleRoutes({
      user,
      restaurantId: restaurant.id,
      now,
    });
    await this.assertRouteReceiptCooldowns({
      userId: user.uid,
      routes: eligibleRoutes,
      now,
    });

    const receiptUploadId = buildReceiptUploadRecordId();
    const stored = await this.imageStorage.uploadImage({
      folder: `receipts/${checkin.restaurantId}/${checkin.id}`,
      file: image,
    });

    const xpRecord = await this.xpService.awardXp({
      userId: user.uid,
      delta: restaurant.pointsPerReceiptUpload,
      sourceType: 'receipt_upload',
      sourceId: checkin.id,
      city: user.city || '',
      country: user.country || '',
    });
    const awardedXp = xpRecord?.xpDelta ?? 0;
    let pointsRecord = null;
    if (awardedXp > 0) {
      pointsRecord = await this.xpService.awardPoints({
        userId: user.uid,
        delta: awardedXp,
        sourceType: 'receipt_upload',
        sourceId: checkin.id,
        city: user.city || '',
        country: user.country || '',
      });
      if (!pointsRecord) {
        await this.xpService.deleteXpRecord(xpRecord.id);
        throw new ApplicationError({
          code: 'receipt_upload_failed',
          message: 'The receipt upload could not be completed right now.',
          statusCode: 500,
        });
      }
    }

    const record = {
      id: receiptUploadId,
      checkinId: checkin.id,
      userId: user.uid,
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      receiptImageUrl: stored.publicUrl,
      receiptStoragePath: stored.storagePath,
      note: String(note ?? '').slice(0, 500),
      status: 'Pending',
      awardedXp,
      awardedPoints: awardedXp,
      createdAt: now,
    };

    try {
      const created = await this.receiptUploadRepository.create(record);
      const routeProgress = await this.applyRouteProgress({
        user,
        routes: eligibleRoutes,
        restaurantId: restaurant.id,
        receiptUpload: created,
        now,
      });
      return {
        data: receiptUploadResponse({ ...created, routeProgress }),
        message: 'Receipt uploaded successfully.',
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

  async resolveEligibleRoutes({ user, restaurantId, now }) {
    if (!this.routeRepository || !this.routeProgressRepository) {
      return [];
    }
    const userCity = String(user.city || '').trim().toLowerCase();
    return (await this.routeRepository.listAll()).filter((route) => {
      if (route.status !== 'active') return false;
      if (!route.restaurantIds.includes(restaurantId)) return false;
      if (route.startDate && route.startDate > now) return false;
      if (route.endDate && route.endDate <= now) return false;
      if (userCity && String(route.city || '').trim().toLowerCase() !== userCity) return false;
      return true;
    });
  }

  async assertRouteReceiptCooldowns({ userId, routes, now }) {
    for (const route of routes) {
      const progress = await this.routeProgressRepository.getLatestByUserAndRoute({
        userId,
        routeId: route.id,
      });
      if (!progress || progress.status === 'completed') {
        continue;
      }
      const cooldownMs = Math.max(60, Number(route.cooldownMinutes ?? 60)) * 60 * 1000;
      if (
        progress.lastReceiptUploadedAt &&
        now.getTime() - progress.lastReceiptUploadedAt.getTime() < cooldownMs
      ) {
        throw new ApplicationError({
          code: 'route_receipt_cooldown_active',
          message: `Route receipt uploads must be at least ${Math.round(cooldownMs / 60000)} minutes apart.`,
          statusCode: 429,
        });
      }
    }
  }

  async applyRouteProgress({ user, routes, restaurantId, receiptUpload, now }) {
    if (!routes.length || !this.routeProgressRepository) {
      return [];
    }
    const results = [];
    for (const route of routes) {
      const result = await this.applySingleRouteProgress({
        user,
        route,
        restaurantId,
        receiptUpload,
        now,
      });
      if (result) {
        results.push(result);
      }
    }
    return results;
  }

  async applySingleRouteProgress({ user, route, restaurantId, receiptUpload, now }) {
    let progress = await this.routeProgressRepository.getLatestByUserAndRoute({
      userId: user.uid,
      routeId: route.id,
    });

    if (progress?.status === 'completed') {
      if (!route.repeatable) {
        return this.routeProgressResponse({ route, progress, reason: 'route_already_completed' });
      }
      if (progress.completedAt && now.getTime() - progress.completedAt.getTime() < ROUTE_REPEAT_COOLDOWN_MS) {
        return this.routeProgressResponse({ route, progress, reason: 'route_repeat_cooldown_active' });
      }
      progress = null;
    }

    if (!progress) {
      progress = await this.routeProgressRepository.create({
        id: randomUUID(),
        routeId: route.id,
        userId: user.uid,
        status: 'in_progress',
        visitedRestaurantIds: [],
        receiptUploadIds: [],
        completedAt: null,
        lastReceiptUploadedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    }

    if (progress.visitedRestaurantIds.includes(restaurantId)) {
      return this.routeProgressResponse({ route, progress, reason: 'restaurant_already_counted' });
    }

    if (route.mandatoryOrder) {
      const expectedRestaurantId = route.restaurantIds[progress.visitedRestaurantIds.length];
      if (expectedRestaurantId && expectedRestaurantId !== restaurantId) {
        return this.routeProgressResponse({ route, progress, reason: 'route_order_mismatch' });
      }
    }

    const visitedRestaurantIds = [...progress.visitedRestaurantIds, restaurantId];
    const receiptUploadIds = [...progress.receiptUploadIds, receiptUpload.id];
    const requiredVisits = route.requiredVisits || route.restaurantIds.length;
    const completed = visitedRestaurantIds.length >= requiredVisits;
    const updated = {
      ...progress,
      status: completed ? 'completed' : 'in_progress',
      visitedRestaurantIds,
      receiptUploadIds,
      completedAt: completed ? now : null,
      lastReceiptUploadedAt: now,
      updatedAt: now,
    };
    const saved = await this.routeProgressRepository.update(progress.id, updated);

    await this.awardRouteReceiptPoints({ user, route, receiptUpload });
    if (completed) {
      await this.awardRouteCompletionBonus({ user, route, progressId: progress.id });
    }

    return this.routeProgressResponse({ route, progress: saved ?? updated, reason: null });
  }

  async awardRouteReceiptPoints({ user, route, receiptUpload }) {
    const delta = Number(route.pointsPerReceiptUpload ?? 0);
    if (delta <= 0) return;
    const sourceId = `${route.id}:${receiptUpload.id}`;
    await this.xpService.awardXp({
      userId: user.uid,
      delta,
      sourceType: 'route_receipt_upload',
      sourceId,
      city: user.city || '',
      country: user.country || '',
    });
    await this.xpService.awardPoints({
      userId: user.uid,
      delta,
      sourceType: 'route_receipt_upload',
      sourceId,
      city: user.city || '',
      country: user.country || '',
    });
  }

  async awardRouteCompletionBonus({ user, route, progressId }) {
    const delta = Number(route.completionBonus ?? 0);
    if (delta <= 0) return;
    const sourceId = `${route.id}:${progressId}`;
    await this.xpService.awardXp({
      userId: user.uid,
      delta,
      sourceType: 'route_completion',
      sourceId,
      city: user.city || '',
      country: user.country || '',
    });
    await this.xpService.awardPoints({
      userId: user.uid,
      delta,
      sourceType: 'route_completion',
      sourceId,
      city: user.city || '',
      country: user.country || '',
    });
  }

  routeProgressResponse({ route, progress, reason }) {
    const requiredVisits = route.requiredVisits || route.restaurantIds.length;
    const visitedCount = new Set(progress.visitedRestaurantIds).size;
    return {
      routeId: route.id,
      routeName: route.routeName,
      status: progress.status,
      reason,
      visitedRestaurantIds: progress.visitedRestaurantIds,
      receiptUploadIds: progress.receiptUploadIds,
      completedAt: progress.completedAt,
      requiredVisits,
      progressPercent: Math.min(100, Math.round((visitedCount / Math.max(1, requiredVisits)) * 100)),
    };
  }

  async resolveLatestEligibleCheckin({ userId, restaurantId }) {
    const checkins = await this.checkinRepository.listByUser(userId);
    for (const checkin of checkins) {
      if (checkin.restaurantId !== restaurantId) {
        continue;
      }
      const existingUpload = await this.receiptUploadRepository.getByCheckinId(checkin.id);
      if (!existingUpload) {
        return checkin;
      }
    }
    throw new ApplicationError({
      code: 'eligible_checkin_not_found',
      message: 'No eligible check-in was found for this restaurant.',
      statusCode: 404,
    });
  }
}
