import { randomUUID } from 'node:crypto';

import { ApplicationError } from '../../core/ApplicationError.js';
import { getAuthenticatedAccount, requireActiveRoles } from '../../shared/auth/authorization.js';

function buildEnabledFeatures(enabledPackages) {
  const packageSet = new Set(enabledPackages);
  const rules = [
    ['basicListing', 'Basic Listing', ['start', 'active', 'pro', 'prime', 'dominio']],
    ['checkInRewards', 'Check-in Rewards', ['active', 'pro', 'prime', 'dominio']],
    ['featuredListing', 'Featured Listing', ['pro', 'prime', 'dominio']],
    ['proximityAlerts', 'Proximity Alerts', ['prime', 'dominio']],
    ['routes', 'Routes', ['dominio']],
    ['premiumAnalytics', 'Premium Analytics', ['dominio']],
  ];

  return rules.map(([key, name, packages]) => ({
    key,
    name,
    enabled: packages.some((item) => packageSet.has(item)),
  }));
}

function restaurantResponse(record) {
  return {
    id: record.id,
    name: record.name,
    address: record.address,
    city: record.city,
    latitude: record.latitude,
    longitude: record.longitude,
    category: record.category,
    imageUrl: record.imageUrl,
    qrCode: record.qrCode,
    pointsPerCheckIn: record.pointsPerCheckIn,
    status: record.status,
    createdBy: record.createdBy,
    enabledPackages: record.enabledPackages,
    enabledFeatures: buildEnabledFeatures(record.enabledPackages),
    packageState:
      record.currentPackage || record.billingCycle || record.activatedAt || record.expiresAt
        ? {
            currentPackage: record.currentPackage ?? null,
            billingCycle: record.billingCycle ?? null,
            activatedAt: record.activatedAt ?? null,
            expiresAt: record.expiresAt ?? null,
          }
        : null,
  };
}

export class RestaurantService {
  constructor({
    restaurantRepository,
    menuService,
    userRepository,
    identityProvider,
    imageStorage,
  }) {
    this.restaurantRepository = restaurantRepository;
    this.menuService = menuService;
    this.userRepository = userRepository;
    this.identityProvider = identityProvider;
    this.imageStorage = imageStorage;
  }

  async createRestaurant({ accessToken, payload, image }) {
    const admin = await this.getCurrentAdmin(accessToken);
    const now = new Date();
    const restaurantId = randomUUID();
    const imageUrl = (
      await this.imageStorage.uploadImage({ folder: `restaurants/${restaurantId}`, file: image })
    ).publicUrl;

    const created = await this.restaurantRepository.create({
      id: restaurantId,
      name: payload.name,
      address: payload.address,
      city: payload.city,
      latitude: payload.latitude,
      longitude: payload.longitude,
      category: payload.category,
      imageUrl,
      qrCode: payload.qrCode,
      pointsPerCheckIn: payload.pointsPerCheckIn,
      enabledPackages: [],
      status: 'inactive',
      createdBy: admin.uid,
      createdAt: now,
      updatedAt: now,
      currentPackage: null,
      billingCycle: null,
      activatedAt: null,
      expiresAt: null,
    });

    await this.menuService.ensureDefaultMenu({
      restaurantId: created.id,
      restaurantName: created.name,
      createdBy: admin.uid,
    });

    return restaurantResponse(created);
  }

  async updateRestaurant({ accessToken, restaurantId, payload, image }) {
    const admin = await this.getCurrentAdmin(accessToken);
    const existing = await this.restaurantRepository.getById(restaurantId);
    if (!existing) {
      throw new ApplicationError({
        code: 'restaurant_not_found',
        message: 'No restaurant found for the provided identifier.',
        statusCode: 404,
      });
    }

    const updated = {
      ...existing,
      name: payload.name,
      address: payload.address,
      city: payload.city,
      latitude: payload.latitude,
      longitude: payload.longitude,
      category: payload.category,
      imageUrl: image
        ? (await this.imageStorage.uploadImage({ folder: `restaurants/${restaurantId}`, file: image }))
            .publicUrl
        : payload.imageUrl || existing.imageUrl,
      qrCode: payload.qrCode,
      pointsPerCheckIn: payload.pointsPerCheckIn,
      createdBy: existing.createdBy || admin.uid,
      updatedAt: new Date(),
    };

    await this.restaurantRepository.update(restaurantId, updated);
    return restaurantResponse(updated);
  }

  async listRestaurants({ accessToken }) {
    await this.getCurrentAccount(accessToken);
    return (await this.restaurantRepository.listAll()).map(restaurantResponse);
  }

  async getRestaurant({ accessToken, restaurantId }) {
    await this.getCurrentAccount(accessToken);
    const restaurant = await this.restaurantRepository.getById(restaurantId);
    if (!restaurant) {
      throw new ApplicationError({
        code: 'restaurant_not_found',
        message: 'No restaurant found for the provided identifier.',
        statusCode: 404,
      });
    }
    return restaurantResponse(restaurant);
  }

  async deleteRestaurant({ accessToken, restaurantId }) {
    await this.getCurrentAdmin(accessToken);
    const deleted = await this.restaurantRepository.delete(restaurantId);
    if (!deleted) {
      throw new ApplicationError({
        code: 'restaurant_not_found',
        message: 'No restaurant found for the provided identifier.',
        statusCode: 404,
      });
    }
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

  async getCurrentAccount(accessToken) {
    const record = await getAuthenticatedAccount({
      accessToken,
      identityProvider: this.identityProvider,
      userRepository: this.userRepository,
    });

    return requireActiveRoles({
      record,
      allowedRoles: new Set(['user', 'admin', 'super_admin']),
      roleErrorCode: 'account_not_found',
      roleErrorMessage: 'No account found for the provided credentials.',
      roleErrorStatusCode: 404,
      blockedErrorCode: 'account_blocked',
      blockedErrorMessage: 'The account is blocked.',
    });
  }
}
