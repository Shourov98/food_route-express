import { ApplicationError } from '../../core/ApplicationError.js';
import { getAuthenticatedAccount, requireActiveRoles } from '../../shared/auth/authorization.js';

const PACKAGE_ORDER = ['start', 'active', 'pro', 'prime', 'dominio'];

const PACKAGE_CATALOG = {
  start: {
    code: 'start',
    name: 'Starter Pack',
    badge: 'START',
    price: 49,
    billingCycle: 'monthly',
    description: 'Entry package for a single restaurant location.',
    features: ['Up to 500 orders/mo', 'Basic Analytics'],
  },
  active: {
    code: 'active',
    name: 'Professional Plan',
    badge: 'ACTIVE',
    price: 129,
    billingCycle: 'annual',
    description: 'Growth package with advanced operational support.',
    features: ['Unlimited orders', 'Advanced AI Analytics', '2 Locations Support'],
  },
  pro: {
    code: 'pro',
    name: 'Restaurant Pro',
    badge: 'PR3',
    price: 89,
    billingCycle: 'monthly',
    description: 'Operational tools for higher volume restaurants.',
    features: ['Up to 2,000 orders/mo', 'Inventory Management', 'Loyalty Program'],
  },
  prime: {
    code: 'prime',
    name: 'Prime Suite',
    badge: 'PRIME',
    price: 299,
    billingCycle: 'annual',
    description: 'Premium package for multi-location growth.',
    features: ['Custom Branding', 'Dedicated Account Manager', 'Unlimited Locations'],
  },
  dominio: {
    code: 'dominio',
    name: 'Dominio Master',
    badge: 'M3 MINI3',
    price: 599,
    billingCycle: 'annual',
    description: 'White-label enterprise package with routing and analytics.',
    features: ['Full White-label Domain', 'Global Franchise API', '24/7 Priority Support'],
  },
};

const FEATURE_PACKAGE_REQUIREMENTS = {
  basicListing: new Set(['start', 'active', 'pro', 'prime', 'dominio']),
  checkInRewards: new Set(['active', 'pro', 'prime', 'dominio']),
  featuredListing: new Set(['pro', 'prime', 'dominio']),
  proximityAlerts: new Set(['prime', 'dominio']),
  routes: new Set(['dominio']),
  premiumAnalytics: new Set(['dominio']),
};

const FEATURE_DISPLAY_NAMES = {
  basicListing: 'Basic Listing',
  checkInRewards: 'Check-in Rewards',
  featuredListing: 'Featured Listing',
  proximityAlerts: 'Proximity Alerts',
  routes: 'Routes',
  premiumAnalytics: 'Premium Analytics',
};

function buildEnabledFeatures(enabledPackages) {
  const packageSet = new Set(enabledPackages);
  return Object.entries(FEATURE_PACKAGE_REQUIREMENTS).map(([key, requiredPackages]) => ({
    key,
    name: FEATURE_DISPLAY_NAMES[key],
    enabled: [...requiredPackages].some((pkg) => packageSet.has(pkg)),
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

export class PackageService {
  constructor({ restaurantRepository, userRepository, identityProvider }) {
    this.restaurantRepository = restaurantRepository;
    this.userRepository = userRepository;
    this.identityProvider = identityProvider;
  }

  async listCatalog({ accessToken }) {
    await this.getCurrentAdmin(accessToken);
    return PACKAGE_ORDER.map((pkg) => PACKAGE_CATALOG[pkg]);
  }

  async listFeatures({ accessToken }) {
    await this.getCurrentAdmin(accessToken);
    return {
      columns: PACKAGE_ORDER.map((pkg) => pkg.charAt(0).toUpperCase() + pkg.slice(1)),
      items: Object.keys(FEATURE_PACKAGE_REQUIREMENTS).map((featureKey) => ({
        name: FEATURE_DISPLAY_NAMES[featureKey],
        values: PACKAGE_ORDER.map((pkg) => FEATURE_PACKAGE_REQUIREMENTS[featureKey].has(pkg)),
      })),
    };
  }

  async activatePackage({ accessToken, restaurantId, payload }) {
    const admin = await this.getCurrentAdmin(accessToken);
    const restaurant = await this.getRestaurantOrError(restaurantId);
    if (restaurant.status !== 'inactive') {
      throw new ApplicationError({
        code: 'package_activation_conflict',
        message: 'Only inactive restaurants can be activated.',
        statusCode: 409,
      });
    }
    return this.applyPackage({ existing: restaurant, packageCode: payload.package, actorUid: admin.uid });
  }

  async upgradePackage({ accessToken, restaurantId, payload }) {
    const admin = await this.getCurrentAdmin(accessToken);
    const restaurant = await this.getRestaurantOrError(restaurantId);
    if (restaurant.status === 'inactive') {
      throw new ApplicationError({
        code: 'package_upgrade_conflict',
        message: 'Activate the restaurant before upgrading its package.',
        statusCode: 409,
      });
    }
    const currentPackage = restaurant.currentPackage ?? this.highestPackage(restaurant.enabledPackages);
    if (!currentPackage) {
      throw new ApplicationError({
        code: 'package_state_missing',
        message: 'The restaurant does not have an active package state.',
        statusCode: 409,
      });
    }
    if (this.packageRank(payload.package) <= this.packageRank(currentPackage)) {
      throw new ApplicationError({
        code: 'package_upgrade_invalid',
        message: 'The target package must be higher than the current package.',
        statusCode: 422,
      });
    }
    return this.applyPackage({ existing: restaurant, packageCode: payload.package, actorUid: admin.uid });
  }

  async applyPackage({ existing, packageCode, actorUid }) {
    const catalogItem = PACKAGE_CATALOG[packageCode];
    if (!catalogItem) {
      throw new ApplicationError({
        code: 'package_not_found',
        message: 'No package found for the provided identifier.',
        statusCode: 404,
      });
    }
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + (catalogItem.billingCycle === 'annual' ? 365 : 30) * 24 * 60 * 60 * 1000,
    );
    const updated = {
      ...existing,
      enabledPackages: [packageCode],
      status: 'active',
      createdBy: existing.createdBy || actorUid,
      updatedAt: now,
      currentPackage: packageCode,
      billingCycle: catalogItem.billingCycle,
      activatedAt: now,
      expiresAt,
    };
    await this.restaurantRepository.update(existing.id, updated);
    return restaurantResponse(updated);
  }

  highestPackage(packages) {
    if (!packages?.length) {
      return null;
    }
    return [...packages].sort((left, right) => this.packageRank(right) - this.packageRank(left))[0];
  }

  packageRank(packageCode) {
    return PACKAGE_ORDER.indexOf(packageCode);
  }

  async getRestaurantOrError(restaurantId) {
    const record = await this.restaurantRepository.getById(restaurantId);
    if (!record) {
      throw new ApplicationError({
        code: 'restaurant_not_found',
        message: 'No restaurant found for the provided identifier.',
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
}
