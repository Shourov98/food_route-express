import { randomUUID } from 'node:crypto';

import { ApplicationError } from '../../core/ApplicationError.js';
import { getAuthenticatedAccount, requireActiveRoles } from '../../shared/auth/authorization.js';

function packageSupportsFeature(pkg, featureKey) {
  const requirements = {
    basicListing: new Set(['start', 'active', 'pro', 'prime', 'dominio']),
    featuredListing: new Set(['pro', 'prime', 'dominio']),
    premiumAnalytics: new Set(['dominio']),
  };
  return requirements[featureKey]?.has(pkg) ?? false;
}

const FEATURE_REQUIREMENTS = {
  trending: 'basicListing',
  featured: 'featuredListing',
  sponsored: 'premiumAnalytics',
};

export class PlacementService {
  constructor({
    placementRepository,
    restaurantRepository,
    userRepository,
    identityProvider,
  }) {
    this.placementRepository = placementRepository;
    this.restaurantRepository = restaurantRepository;
    this.userRepository = userRepository;
    this.identityProvider = identityProvider;
  }

  async listByFeature({ accessToken, feature }) {
    await this.getCurrentAdmin(accessToken);
    const records = await this.placementRepository.listByFeature(feature);
    return Promise.all(records.map((record) => this.toResponse(record)));
  }

  async listFeatures({ accessToken }) {
    await this.getCurrentAdmin(accessToken);
    return ['trending', 'featured', 'sponsored'];
  }

  async assignPlacement({ accessToken, payload }) {
    const admin = await this.getCurrentAdmin(accessToken);
    const restaurant = await this.getActiveRestaurantOrError(payload.restaurantId);
    const requiredFeature = FEATURE_REQUIREMENTS[payload.feature];
    if (!restaurant.currentPackage || !packageSupportsFeature(restaurant.currentPackage, requiredFeature)) {
      throw new ApplicationError({
        code: 'placement_package_missing',
        message: 'Restaurant package does not support the selected placement.',
        statusCode: 409,
      });
    }
    const existing = await this.placementRepository.getByFeatureAndRestaurant({
      feature: payload.feature,
      restaurantId: payload.restaurantId,
    });
    if (existing) {
      throw new ApplicationError({
        code: 'placement_conflict',
        message: 'This restaurant already has a placement for the selected feature.',
        statusCode: 409,
      });
    }
    const now = new Date();
    const created = await this.placementRepository.create({
      id: randomUUID(),
      feature: payload.feature,
      restaurantId: payload.restaurantId,
      active: payload.active,
      sortOrder: payload.sortOrder,
      createdBy: admin.uid,
      createdAt: now,
      updatedAt: now,
    });
    return this.toResponse(created);
  }

  async removePlacement({ accessToken, placementId }) {
    await this.getCurrentAdmin(accessToken);
    const deleted = await this.placementRepository.delete(placementId);
    if (!deleted) {
      throw new ApplicationError({
        code: 'placement_not_found',
        message: 'No placement found for the provided identifier.',
        statusCode: 404,
      });
    }
  }

  async togglePlacementStatus({ accessToken, placementId }) {
    await this.getCurrentAdmin(accessToken);
    const existing = await this.placementRepository.getById(placementId);
    if (!existing) {
      throw new ApplicationError({
        code: 'placement_not_found',
        message: 'No placement found for the provided identifier.',
        statusCode: 404,
      });
    }
    const updated = {
      ...existing,
      active: !existing.active,
      updatedAt: new Date(),
    };
    await this.placementRepository.update(placementId, updated);
    return this.toResponse(updated);
  }

  async getActiveRestaurantOrError(restaurantId) {
    const record = await this.restaurantRepository.getById(restaurantId);
    if (!record) {
      throw new ApplicationError({
        code: 'restaurant_not_found',
        message: 'No restaurant found for the provided identifier.',
        statusCode: 404,
      });
    }
    if (record.status !== 'active') {
      throw new ApplicationError({
        code: 'restaurant_not_active',
        message: 'Restaurant must be active before placement assignment.',
        statusCode: 409,
      });
    }
    if (!record.currentPackage) {
      throw new ApplicationError({
        code: 'restaurant_package_missing',
        message: 'Restaurant must have an active package before placement assignment.',
        statusCode: 409,
      });
    }
    return record;
  }

  async toResponse(record) {
    const restaurant = await this.restaurantRepository.getById(record.restaurantId);
    if (!restaurant) {
      throw new ApplicationError({
        code: 'restaurant_not_found',
        message: 'No restaurant found for the provided identifier.',
        statusCode: 404,
      });
    }
    return {
      id: record.id,
      feature: record.feature,
      active: record.active,
      sortOrder: record.sortOrder,
      restaurantId: record.restaurantId,
      restaurantName: restaurant.name,
      restaurantCategory: restaurant.category,
      restaurantAddress: restaurant.address,
      restaurantImageUrl: restaurant.imageUrl,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
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
}
