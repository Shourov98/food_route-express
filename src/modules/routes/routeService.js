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

export class RouteService {
  constructor({
    routeRepository,
    restaurantRepository,
    userRepository,
    identityProvider,
  }) {
    this.routeRepository = routeRepository;
    this.restaurantRepository = restaurantRepository;
    this.userRepository = userRepository;
    this.identityProvider = identityProvider;
  }

  async createRoute({ accessToken, payload }) {
    const admin = await this.getCurrentAdmin(accessToken);
    const restaurants = await this.getValidRestaurants(payload.restaurantIds);
    const now = new Date();
    const created = await this.routeRepository.create({
      id: randomUUID(),
      routeName: payload.routeName,
      description: payload.description,
      city: deriveRouteCity(restaurants, payload.city ?? null),
      restaurantIds: restaurants.map((restaurant) => restaurant.id),
      status: payload.status,
      createdBy: admin.uid,
      createdAt: now,
      updatedAt: now,
    });
    return this.toResponse(created, { restaurants });
  }

  async updateRoute({ accessToken, routeId, payload }) {
    await this.getCurrentAdmin(accessToken);
    const existing = await this.getRouteOrError(routeId);
    const restaurantIds = payload.restaurantIds ?? existing.restaurantIds;
    const restaurants = await this.getValidRestaurants(restaurantIds);
    const updated = {
      ...existing,
      routeName: payload.routeName ?? existing.routeName,
      description: payload.description ?? existing.description,
      city: deriveRouteCity(restaurants, payload.city ?? existing.city ?? null),
      restaurantIds: restaurants.map((restaurant) => restaurant.id),
      status: payload.status ?? existing.status,
      updatedAt: new Date(),
    };
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
        records.slice(start, start + pageSize).map((record) => this.toResponse(record)),
      ),
      pagination: buildPaginationMeta({ page, pageSize, totalItems }),
    };
  }

  async getRoute({ accessToken, routeId }) {
    await this.getCurrentAdmin(accessToken);
    const record = await this.getRouteOrError(routeId);
    const restaurants = await this.getRestaurantsByIds(record.restaurantIds);
    return this.toResponse(record, { restaurants });
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

  async toResponse(record, { restaurants = null } = {}) {
    const restaurantRecords = restaurants ?? (await this.getRestaurantsByIds(record.restaurantIds));
    return {
      id: record.id,
      routeName: record.routeName,
      description: record.description,
      city: record.city,
      restaurantIds: record.restaurantIds,
      restaurants: restaurantRecords.map(restaurantSummary),
      restaurantCount: restaurantRecords.length,
      status: record.status,
      createdBy: record.createdBy,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
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
