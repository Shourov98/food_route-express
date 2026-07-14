import { randomUUID } from 'node:crypto';

import { ApplicationError } from '../../core/ApplicationError.js';
import { getAuthenticatedAccount, requireActiveRoles } from '../../shared/auth/authorization.js';
import { buildPaginationMeta } from '../../shared/pagination.js';

function packageSupportsFeature(pkg, featureKey) {
  const requirements = {
    basicListing: new Set(['start', 'active', 'pro', 'prime', 'dominio']),
    checkInRewards: new Set(['active', 'pro', 'prime', 'dominio']),
    featuredListing: new Set(['pro', 'prime', 'dominio']),
    proximityAlerts: new Set(['prime', 'dominio']),
    routes: new Set(['dominio']),
    premiumAnalytics: new Set(['dominio']),
  };
  return requirements[featureKey]?.has(pkg) ?? false;
}

function routeEnabled(restaurant) {
  if (restaurant.currentPackage && packageSupportsFeature(restaurant.currentPackage, 'routes')) {
    return true;
  }

  if (Array.isArray(restaurant.enabledPackages)) {
    return restaurant.enabledPackages.some((pkg) => packageSupportsFeature(pkg, 'routes'));
  }

  return false;
}

function routeRestaurantEligible(restaurant) {
  return restaurant?.status === 'active' && routeEnabled(restaurant);
}

function deriveRouteCity(restaurants, fallbackCity = null) {
  const uniqueCities = [
    ...new Set(
      restaurants
        .map((restaurant) => String(restaurant.city || '').trim())
        .filter(Boolean),
    ),
  ];

  if (uniqueCities.length === 0) {
    return fallbackCity ?? '';
  }

  if (uniqueCities.length === 1) {
    return uniqueCities[0];
  }

  return 'Multiple Cities';
}

function restaurantSearchItem(record) {
  return {
    id: record.id,
    name: record.name,
    address: record.address,
    city: record.city,
    latitude: record.latitude,
    longitude: record.longitude,
    category: record.category,
    imageUrl: record.imageUrl,
    currentPackage: record.currentPackage ?? null,
    billingCycle: record.billingCycle ?? null,
    routeFeatureEnabled: routeEnabled(record),
  };
}

function restaurantSummary(record) {
  return restaurantSearchItem(record);
}

function assertRequiredVisitsPossible(requiredVisits, restaurantCount) {
  if (requiredVisits > restaurantCount) {
    throw new ApplicationError({
      code: 'route_required_visits_invalid',
      message: 'Required visits cannot exceed the number of participating restaurants.',
      statusCode: 400,
    });
  }
}

function assertRouteDateRange({ startDate, endDate }) {
  if (startDate && endDate && endDate <= startDate) {
    throw new ApplicationError({
      code: 'route_date_range_invalid',
      message: 'Route end date must be after the start date.',
      statusCode: 400,
    });
  }
}

const ANALYTICS_RANGE_DAYS = {
  last_7_days: 7,
  last_30_days: 30,
  last_90_days: 90,
};

function analyticsWindow(range, now = new Date()) {
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - (ANALYTICS_RANGE_DAYS[range] ?? 30) + 1);
  start.setUTCHours(0, 0, 0, 0);
  return { range, start, end: now };
}

export class RouteService {
  constructor({
    routeRepository,
    routeProgressRepository = null,
    checkinRepository = null,
    restaurantRepository,
    userRepository,
    identityProvider,
  }) {
    this.routeRepository = routeRepository;
    this.routeProgressRepository = routeProgressRepository;
    this.checkinRepository = checkinRepository;
    this.restaurantRepository = restaurantRepository;
    this.userRepository = userRepository;
    this.identityProvider = identityProvider;
  }

  async createRoute({ accessToken, payload }) {
    const admin = await this.getCurrentAdmin(accessToken);
    const restaurants = await this.getValidRestaurants(payload.restaurantIds);
    const requiredVisits = payload.requiredVisits ?? restaurants.length;
    assertRequiredVisitsPossible(requiredVisits, restaurants.length);
    const now = new Date();
    const record = {
      id: randomUUID(),
      routeName: payload.routeName,
      description: payload.description,
      city: deriveRouteCity(restaurants, payload.city ?? null),
      zone: payload.zone ?? null,
      neighborhood: payload.neighborhood ?? null,
      restaurantIds: restaurants.map((restaurant) => restaurant.id),
      status: payload.status,
      startDate: payload.startDate ?? null,
      endDate: payload.endDate ?? null,
      requiredVisits,
      mandatoryOrder: payload.mandatoryOrder ?? false,
      pointsPerReceiptUpload: payload.pointsPerReceiptUpload ?? 0,
      completionBonus: payload.completionBonus ?? 0,
      limitPerUser: payload.limitPerUser ?? 1,
      repeatable: payload.repeatable ?? false,
      cooldownMinutes: payload.cooldownMinutes ?? 60,
      createdBy: admin.uid,
      createdAt: now,
      updatedAt: now,
    };
    assertRouteDateRange(record);
    const created = await this.routeRepository.create(record);
    return this.toResponse(created, { restaurants });
  }

  async updateRoute({ accessToken, routeId, payload }) {
    await this.getCurrentAdmin(accessToken);
    const existing = await this.getRouteOrError(routeId);
    const restaurantIds = payload.restaurantIds ?? existing.restaurantIds;
    const restaurants = await this.getValidRestaurants(restaurantIds);
    const requiredVisits = payload.requiredVisits ?? existing.requiredVisits ?? restaurants.length;
    assertRequiredVisitsPossible(requiredVisits, restaurants.length);
    const updated = {
      ...existing,
      routeName: payload.routeName ?? existing.routeName,
      description: payload.description ?? existing.description,
      city: deriveRouteCity(restaurants, payload.city ?? existing.city ?? null),
      zone: payload.zone ?? existing.zone ?? null,
      neighborhood: payload.neighborhood ?? existing.neighborhood ?? null,
      restaurantIds: restaurants.map((restaurant) => restaurant.id),
      status: payload.status ?? existing.status,
      startDate: payload.hasStartDateField ? payload.startDate ?? null : existing.startDate ?? null,
      endDate: payload.hasEndDateField ? payload.endDate ?? null : existing.endDate ?? null,
      requiredVisits,
      mandatoryOrder: payload.mandatoryOrder ?? existing.mandatoryOrder ?? false,
      pointsPerReceiptUpload: payload.pointsPerReceiptUpload ?? existing.pointsPerReceiptUpload ?? 0,
      completionBonus: payload.completionBonus ?? existing.completionBonus ?? 0,
      limitPerUser: payload.limitPerUser ?? existing.limitPerUser ?? 1,
      repeatable: payload.repeatable ?? existing.repeatable ?? false,
      cooldownMinutes: payload.cooldownMinutes ?? existing.cooldownMinutes ?? 60,
      updatedAt: new Date(),
    };
    assertRouteDateRange(updated);
    await this.routeRepository.update(routeId, updated);
    return this.toResponse(updated, { restaurants });
  }

  async listRoutes({ accessToken, page, pageSize, search, city, statusFilter }) {
    await this.getCurrentAdmin(accessToken);
    let records = await this.routeRepository.listAll();
    if (search) {
      const needle = search.trim().toLowerCase();
      records = records.filter(
        (record) =>
          record.routeName.toLowerCase().includes(needle) ||
          record.description.toLowerCase().includes(needle) ||
          record.city.toLowerCase().includes(needle),
      );
    }
    if (city) {
      const cityNeedle = city.trim().toLowerCase();
      records = records.filter((record) => record.city.toLowerCase() === cityNeedle);
    }
    if (statusFilter) {
      records = records.filter((record) => record.status === statusFilter);
    }
    records = [...records].sort(
      (left, right) =>
        right.createdAt.getTime() - left.createdAt.getTime() || right.id.localeCompare(left.id),
    );
    const totalItems = records.length;
    const start = (page - 1) * pageSize;
    return {
      items: await Promise.all(
        records.slice(start, start + pageSize).map((record) =>
          this.toResponse(record, { userId: user.uid }),
        ),
      ),
      pagination: buildPaginationMeta({ page, pageSize, totalItems }),
    };
  }

  async getRoute({ accessToken, routeId }) {
    await this.getCurrentAdmin(accessToken);
    const record = await this.getRouteOrError(routeId);
    const restaurants = await this.getRestaurantsByIds(record.restaurantIds);
    return this.toResponse(record, { restaurants, userId: user.uid });
  }

  async getRouteAnalytics({ accessToken, range }) {
    await this.getCurrentAdmin(accessToken);
    const window = analyticsWindow(range);
    const [routes, checkins] = await Promise.all([
      this.routeRepository.listAll(),
      this.checkinRepository ? this.checkinRepository.listAll() : [],
    ]);
    const activeCheckins = checkins.filter(
      (record) => window.start <= record.createdAt && record.createdAt <= window.end,
    );
    const items = routes.map((route) => {
      const routeRestaurantIds = new Set(route.restaurantIds);
      const coveredCheckins = activeCheckins.filter((record) => routeRestaurantIds.has(record.restaurantId));
      return {
        routeId: route.id,
        routeName: route.routeName,
        city: route.city,
        status: route.status,
        restaurantCount: route.restaurantIds.length,
        coveredCheckIns: coveredCheckins.length,
        coveredUniqueUsers: new Set(coveredCheckins.map((record) => record.userId)).size,
        routeVisits: 0,
      };
    });
    items.sort((left, right) => right.coveredCheckIns - left.coveredCheckIns || left.routeName.localeCompare(right.routeName));
    return {
      range: window.range,
      from: window.start,
      to: window.end,
      routeVisitsTracked: false,
      items,
    };
  }

  async deleteRoute({ accessToken, routeId }) {
    await this.getCurrentAdmin(accessToken);
    const deleted = await this.routeRepository.delete(routeId);
    if (!deleted) {
      throw new ApplicationError({
        code: 'route_not_found',
        message: 'No route found for the provided identifier.',
        statusCode: 404,
      });
    }
  }

  async listMyRoutes({ accessToken, page, pageSize, search }) {
    const user = await this.getCurrentUser(accessToken);
    let records = (await this.routeRepository.listAll()).filter(
      (record) =>
        record.status === 'active' &&
        String(record.city || '').trim().toLowerCase() === String(user.city || '').trim().toLowerCase(),
    );
    if (search) {
      const needle = search.trim().toLowerCase();
      records = records.filter(
        (record) =>
          record.routeName.toLowerCase().includes(needle) ||
          record.description.toLowerCase().includes(needle) ||
          record.city.toLowerCase().includes(needle),
      );
    }
    records = [...records].sort(
      (left, right) =>
        right.createdAt.getTime() - left.createdAt.getTime() || right.id.localeCompare(left.id),
    );
    const totalItems = records.length;
    const start = (page - 1) * pageSize;
    return {
      items: await Promise.all(
        records.slice(start, start + pageSize).map((record) => this.toResponse(record)),
      ),
      pagination: buildPaginationMeta({ page, pageSize, totalItems }),
    };
  }

  async getMyRoute({ accessToken, routeId }) {
    const user = await this.getCurrentUser(accessToken);
    const record = await this.getRouteOrError(routeId);
    if (
      record.status !== 'active' ||
      String(record.city || '').trim().toLowerCase() !== String(user.city || '').trim().toLowerCase()
    ) {
      throw new ApplicationError({
        code: 'route_not_found',
        message: 'No route found for the provided identifier.',
        statusCode: 404,
      });
    }
    const restaurants = await this.getRestaurantsByIds(record.restaurantIds);
    return this.toResponse(record, { restaurants });
  }

  async searchRestaurantsByCity({ accessToken, city, search, page, pageSize }) {
    await this.getCurrentAdmin(accessToken);
    let records = (await this.restaurantRepository.listAll()).filter((record) => routeRestaurantEligible(record));
    if (city) {
      const cityNeedle = city.trim().toLowerCase();
      records = records.filter(
        (record) => String(record.city || '').trim().toLowerCase() === cityNeedle,
      );
    }
    if (search) {
      const needle = search.trim().toLowerCase();
      records = records.filter(
        (record) =>
          record.name.toLowerCase().includes(needle) ||
          record.address.toLowerCase().includes(needle) ||
          record.category.toLowerCase().includes(needle) ||
          String(record.city || '').toLowerCase().includes(needle),
      );
    }
    records = [...records].sort(
      (left, right) => left.name.toLowerCase().localeCompare(right.name.toLowerCase()) || left.id.localeCompare(right.id),
    );
    const totalItems = records.length;
    const start = (page - 1) * pageSize;
    return {
      items: records.slice(start, start + pageSize).map(restaurantSearchItem),
      pagination: buildPaginationMeta({ page, pageSize, totalItems }),
    };
  }

  async getValidRestaurants(restaurantIds) {
    const uniqueIds = [...new Set(restaurantIds)];
    const restaurants = [];
    for (const restaurantId of uniqueIds) {
      const restaurant = await this.restaurantRepository.getById(restaurantId);
      if (!restaurant) {
        throw new ApplicationError({
          code: 'route_restaurant_not_found',
          message: 'One or more restaurants in the route could not be found.',
          statusCode: 404,
        });
      }
      if (!routeRestaurantEligible(restaurant)) {
        throw new ApplicationError({
          code: 'route_feature_not_enabled',
          message: 'All selected restaurants must be active and have the dominio routes feature enabled.',
          statusCode: 409,
        });
      }
      restaurants.push(restaurant);
    }
    return restaurants;
  }

  async getRestaurantsByIds(restaurantIds) {
    const restaurants = [];
    for (const restaurantId of restaurantIds) {
      const restaurant = await this.restaurantRepository.getById(restaurantId);
      if (!restaurant) {
        throw new ApplicationError({
          code: 'route_restaurant_not_found',
          message: 'One or more restaurants in the route could not be found.',
          statusCode: 404,
        });
      }
      restaurants.push(restaurant);
    }
    return restaurants;
  }

  async toResponse(record, { restaurants = null, userId = null, now = new Date() } = {}) {
    const restaurantRecords = restaurants ?? (await this.getRestaurantsByIds(record.restaurantIds));
    const progress = userId ? await this.routeProgressForUser({ userId, route: record, now }) : null;
    return {
      id: record.id,
      routeName: record.routeName,
      description: record.description,
      city: record.city,
      zone: record.zone ?? null,
      neighborhood: record.neighborhood ?? null,
      restaurantIds: record.restaurantIds,
      restaurants: restaurantRecords.map(restaurantSummary),
      restaurantCount: restaurantRecords.length,
      status: record.status,
      startDate: record.startDate ?? null,
      endDate: record.endDate ?? null,
      requiredVisits: record.requiredVisits || restaurantRecords.length,
      mandatoryOrder: Boolean(record.mandatoryOrder),
      pointsPerReceiptUpload: Number(record.pointsPerReceiptUpload ?? 0),
      completionBonus: Number(record.completionBonus ?? 0),
      limitPerUser: Number(record.limitPerUser ?? 1),
      repeatable: Boolean(record.repeatable),
      cooldownMinutes: Number(record.cooldownMinutes ?? 60),
      createdBy: record.createdBy,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      userProgress: progress,
    };
  }

  async routeProgressForUser({ userId, route, now = new Date() }) {
    if (!this.routeProgressRepository) {
      return null;
    }
    const records = await this.routeProgressRepository.listByUserAndRoute({
      userId,
      routeId: route.id,
    });
    const latest = records[0] ?? null;
    const requiredVisits = route.requiredVisits || route.restaurantIds.length;
    if (!latest) {
      return {
        status: 'not_started',
        visitedRestaurantIds: [],
        completedAt: null,
        requiredVisits,
        progressPercent: 0,
      };
    }
    const visitedCount = new Set(latest.visitedRestaurantIds).size;
    // BR-018 lazy expiration: when the route's endDate has passed and the
    // user never reached completion, the row stays in the DB but we surface
    // it as 'expired' in the response. No DB write needed — the next time
    // the user opens the route or a receipt upload is attempted, the eligibility
    // filter still uses route.endDate (see receiptUploadService.resolveEligibleRoutes).
    const lazyStatus =
      route.endDate &&
      latest.status === 'in_progress' &&
      route.endDate.getTime() <= now.getTime()
        ? 'expired'
        : latest.status;
    return {
      id: latest.id,
      status: lazyStatus,
      visitedRestaurantIds: latest.visitedRestaurantIds,
      receiptUploadIds: latest.receiptUploadIds,
      completedAt: latest.completedAt,
      requiredVisits,
      progressPercent: Math.min(100, Math.round((visitedCount / Math.max(1, requiredVisits)) * 100)),
      lastReceiptUploadedAt: latest.lastReceiptUploadedAt,
    };
  }

  async getRouteOrError(routeId) {
    const record = await this.routeRepository.getById(routeId);
    if (!record) {
      throw new ApplicationError({
        code: 'route_not_found',
        message: 'No route found for the provided identifier.',
        statusCode: 404,
      });
    }
    return record;
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
