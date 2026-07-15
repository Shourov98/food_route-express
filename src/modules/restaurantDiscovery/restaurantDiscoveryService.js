import { ApplicationError, validationError } from '../../core/ApplicationError.js';
import { getAuthenticatedAccount, requireActiveRoles } from '../../shared/auth/authorization.js';
import { buildPaginationMeta } from '../../shared/pagination.js';
import {
  getActiveCityNames,
  isActiveCity,
  loadGeographyConfig,
  outOfServiceMessage,
  resolveRadiusKm,
  resolveSecondaryRadiusKm,
  SECONDARY_RADIUS_MULTIPLIER,
  SECONDARY_PROXIMITY_RADIUS_KM,
} from '../geography/geographyPolicy.js';
import {
  DEFAULT_PLATFORM,
  buildMapsUrls,
  parsePlatform,
} from '../navigation/navigationPolicy.js';

function normalizeCity(value) {
  return String(value ?? '').trim().toLowerCase();
}

function distanceKm(latitude, longitude, restaurantLatitude, restaurantLongitude) {
  if (latitude === null || longitude === null) {
    return null;
  }
  const radiusKm = 6371;
  const lat1 = (latitude * Math.PI) / 180;
  const lon1 = (longitude * Math.PI) / 180;
  const lat2 = (restaurantLatitude * Math.PI) / 180;
  const lon2 = (restaurantLongitude * Math.PI) / 180;
  const deltaLat = lat2 - lat1;
  const deltaLon = lon2 - lon1;
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(radiusKm * c * 100) / 100;
}

function ratingSummary(reviews) {
  if (!reviews.length) {
    return { averageRating: 0, totalReviews: 0 };
  }
  return {
    averageRating: Math.round((reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length) * 100) / 100,
    totalReviews: reviews.length,
  };
}

function parseNumber(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw validationError('Invalid numeric query parameter.');
  }
  return number;
}

function hasLocation(latitude, longitude) {
  return latitude !== null && longitude !== null;
}

function supportsFeature(record, featureKey) {
  const matrix = {
    featuredListing: new Set(['pro', 'prime', 'dominio']),
  };
  return Boolean(record.currentPackage && matrix[featureKey]?.has(record.currentPackage));
}

function listItem(record, { latitude, longitude, reviews, isFavorite }) {
  return {
    id: record.id,
    name: record.name,
    address: record.address,
    city: record.city,
    latitude: record.latitude,
    longitude: record.longitude,
    category: record.category,
    imageUrl: record.imageUrl,
    pointsPerCheckIn: record.pointsPerCheckIn,
    distanceKm: distanceKm(latitude, longitude, record.latitude, record.longitude),
    ratingSummary: ratingSummary(reviews),
    isFavorite,
  };
}

function reviewItem(review) {
  return {
    id: review.id,
    userId: review.userId,
    userFullname: review.userFullname,
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
  };
}

function menuItemData(item) {
  return {
    itemId: item.id,
    name: item.name,
    description: item.description,
    price: Math.round((item.priceInCents / 100) * 100) / 100,
    pointsToBuy: item.pointsToBuy,
    imageUrl: item.imageUrl,
    isAvailable: item.isAvailable,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

// BR-011 — placement boost tiers. Lower numbers sort first within the
// primary band. `none` is the default for unplaced restaurants.
const PLACEMENT_TIERS = Object.freeze({
  sponsored: 0,
  featured: 1,
  trending: 2,
  none: 3,
});

function placementTierFor(item, placementBoosts) {
  if (!placementBoosts) return PLACEMENT_TIERS.none;
  for (const feature of ['sponsored', 'featured', 'trending']) {
    const boost = placementBoosts.get(feature);
    if (boost?.has(item.id)) {
      return PLACEMENT_TIERS[feature];
    }
  }
  return PLACEMENT_TIERS.none;
}

/**
 * BR-011 — Build the placement boost map. Returns `null` when the
 * placement repository is unavailable (no Firestore wiring), letting
 * `buildListResponse` fall back to the closest-first sort.
 *
 * The shape is `Map<feature, Map<restaurantId, { sortOrder }>>` —
 * feature names use the canonical placement feature strings.
 */
async function buildPlacementBoosts(placementRepository, restaurantIds) {
  if (!placementRepository) return null;
  const features = ['sponsored', 'featured', 'trending'];
  const sets = await Promise.all(
    features.map(async (feature) => {
      const records = await placementRepository.listByFeature(feature);
      const ids = new Set();
      for (const record of records) {
        if (record.active && restaurantIds.has(record.restaurantId)) {
          ids.add(record.restaurantId);
        }
      }
      return [feature, ids];
    }),
  );
  return new Map(sets);
}

function resolveEffectiveRadii({ user, geographyConfig, radiusKm }) {
  if (Number.isFinite(radiusKm) && radiusKm > 0) {
    const widened = Math.max(
      radiusKm * SECONDARY_RADIUS_MULTIPLIER,
      geographyConfig?.secondaryRadiusKm ?? SECONDARY_PROXIMITY_RADIUS_KM,
    );
    return { primaryRadiusKm: radiusKm, secondaryRadiusKm: widened, source: 'query' };
  }
  return {
    primaryRadiusKm: resolveRadiusKm(user, geographyConfig),
    secondaryRadiusKm: resolveSecondaryRadiusKm(user, geographyConfig),
    source: 'user',
  };
}

export class RestaurantDiscoveryService {
  constructor({
    restaurantRepository,
    menuRepository,
    menuItemRepository,
    reviewRepository,
    favoriteRepository,
    userRepository,
    identityProvider,
    geographyConfig = loadGeographyConfig(),
    placementRepository = null,
  }) {
    this.restaurantRepository = restaurantRepository;
    this.menuRepository = menuRepository;
    this.menuItemRepository = menuItemRepository;
    this.reviewRepository = reviewRepository;
    this.favoriteRepository = favoriteRepository;
    this.userRepository = userRepository;
    this.identityProvider = identityProvider;
    this.geographyConfig = geographyConfig;
    this.placementRepository = placementRepository;
  }

  parseLocation(query) {
    return {
      latitude: parseNumber(query.latitude),
      longitude: parseNumber(query.longitude),
    };
  }

  /**
   * Parse an optional `?radius=` (km) override. Returns `null` when
   * missing; rejects non-finite numeric values via `validationError`.
   * Negative or zero values fall back to the user's default radius.
   */
  parseRadius(query) {
    if (query?.radius === undefined || query?.radius === null || query?.radius === '') {
      return null;
    }
    return parseNumber(query.radius);
  }

  /**
   * BR-010: enforce the active-city allowlist on manual city selection.
   * Throws an `out_of_service_area` ApplicationError when:
   *   1. The client supplied `?city=` and it's not in the active set, OR
   *   2. The client supplied no `?city=` AND no lat/lng AND the user's
   *      profile.city is set and not in the active set.
   *
   * When lat/lng are supplied we still return results even if the user's
   * profile.city is in a non-active region — the lat/lng-based nearby
   * flow uses the soft `serviceArea.outOfServiceArea` body flag instead
   * of a hard error.
   */
  enforceManualCity({ city, latitude, longitude, user }) {
    if (city) {
      if (!isActiveCity(city, this.geographyConfig)) {
        throw new ApplicationError({
          code: 'out_of_service_area',
          statusCode: 404,
          message: outOfServiceMessage(this.geographyConfig),
          details: {
            activeCities: getActiveCityNames(this.geographyConfig),
            requestedCity: city,
          },
        });
      }
      return;
    }
    if (!hasLocation(latitude, longitude) && user?.city && !isActiveCity(user.city, this.geographyConfig)) {
      throw new ApplicationError({
        code: 'out_of_service_area',
        statusCode: 404,
        message: outOfServiceMessage(this.geographyConfig),
        details: {
          activeCities: getActiveCityNames(this.geographyConfig),
          profileCity: user.city,
        },
      });
    }
  }

  async listRestaurants({ accessToken, page, pageSize, search, city, latitude, longitude, radiusKm }) {
    const user = await this.getCurrentUser(accessToken);
    const favoriteIds = await this.favoriteIds(user.uid);
    let records = (await this.restaurantRepository.listAll()).filter(
      (record) => record.status === 'active',
    );
    records = this.filterRestaurants(records, { search, city });
    const placementBoosts = await buildPlacementBoosts(
      this.placementRepository,
      new Set(records.map((record) => record.id)),
    );
    const { primaryRadiusKm, secondaryRadiusKm } = resolveEffectiveRadii({
      user,
      geographyConfig: this.geographyConfig,
      radiusKm,
    });
    return this.buildListResponse({
      records,
      page,
      pageSize,
      latitude,
      longitude,
      favoriteIds,
      primaryRadiusKm,
      secondaryRadiusKm,
      placementBoosts,
    });
  }

  async listFeaturedRestaurants({ accessToken, page, pageSize, search, city, latitude, longitude, radiusKm }) {
    const user = await this.getCurrentUser(accessToken);
    const favoriteIds = await this.favoriteIds(user.uid);
    let records = (await this.restaurantRepository.listAll()).filter(
      (record) =>
        record.status === 'active' &&
        supportsFeature(record, 'featuredListing'),
    );
    records = this.filterRestaurants(records, { search, city });
    const placementBoosts = await buildPlacementBoosts(
      this.placementRepository,
      new Set(records.map((record) => record.id)),
    );
    const { primaryRadiusKm, secondaryRadiusKm } = resolveEffectiveRadii({
      user,
      geographyConfig: this.geographyConfig,
      radiusKm,
    });
    return this.buildListResponse({
      records,
      page,
      pageSize,
      latitude,
      longitude,
      favoriteIds,
      primaryRadiusKm,
      secondaryRadiusKm,
      placementBoosts,
    });
  }

  async listNearbyRestaurants({ accessToken, page, pageSize, search, city, latitude, longitude, radiusKm }) {
    const user = await this.getCurrentUser(accessToken);
    // Don't enforce a hard error here: the lat/lng-based "nearby" flow is
    // a probe and the soft serviceArea flag is more useful. We still
    // respect the active-city allowlist on manual city selection.
    if (city && !isActiveCity(city, this.geographyConfig)) {
      throw new ApplicationError({
        code: 'out_of_service_area',
        statusCode: 404,
        message: outOfServiceMessage(this.geographyConfig),
        details: {
          activeCities: getActiveCityNames(this.geographyConfig),
          requestedCity: city,
        },
      });
    }
    const favoriteIds = await this.favoriteIds(user.uid);
    const effectiveCity = city || null;
    let records = (await this.restaurantRepository.listAll()).filter(
      (record) => record.status === 'active',
    );
    records = this.filterRestaurants(records, { search, city: effectiveCity });
    const placementBoosts = await buildPlacementBoosts(
      this.placementRepository,
      new Set(records.map((record) => record.id)),
    );
    const { primaryRadiusKm, secondaryRadiusKm } = resolveEffectiveRadii({
      user,
      geographyConfig: this.geographyConfig,
      radiusKm,
    });
    return this.buildListResponse({
      records,
      page,
      pageSize,
      latitude,
      longitude,
      favoriteIds,
      primaryRadiusKm,
      secondaryRadiusKm,
      enforceProximityBands: hasLocation(latitude, longitude),
      placementBoosts,
    });
  }

  async getRestaurant({ accessToken, restaurantId, latitude, longitude }) {
    const user = await this.getCurrentUser(accessToken);
    const restaurant = await this.getActiveRestaurant(restaurantId);
    const menu = await this.menuRepository.getByRestaurantId(restaurant.id);
    const menuItems = menu ? await this.menuItemRepository.listByMenuId(menu.id) : [];
    const reviews = await this.reviewRepository.listByRestaurant(restaurant.id);
    const favoriteIds = await this.favoriteIds(user.uid);

    return {
      id: restaurant.id,
      name: restaurant.name,
      address: restaurant.address,
      city: restaurant.city,
      latitude: restaurant.latitude,
      longitude: restaurant.longitude,
      category: restaurant.category,
      imageUrl: restaurant.imageUrl,
      pointsPerCheckIn: restaurant.pointsPerCheckIn,
      distanceKm: distanceKm(latitude, longitude, restaurant.latitude, restaurant.longitude),
      ratingSummary: ratingSummary(reviews),
      menuItems: menuItems.map(menuItemData),
      reviews: reviews.map(reviewItem),
      isFavorite: favoriteIds.has(restaurant.id),
    };
  }

  async getRestaurantMenu({ accessToken, restaurantId, latitude, longitude }) {
    const user = await this.getCurrentUser(accessToken);
    const restaurant = await this.getActiveRestaurant(restaurantId);
    const menu = await this.menuRepository.getByRestaurantId(restaurant.id);
    const menuItems = menu ? await this.menuItemRepository.listByMenuId(menu.id) : [];
    const reviews = await this.reviewRepository.listByRestaurant(restaurant.id);
    const favoriteIds = await this.favoriteIds(user.uid);

    return {
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      restaurantAddress: restaurant.address,
      city: restaurant.city,
      latitude: restaurant.latitude,
      longitude: restaurant.longitude,
      category: restaurant.category,
      imageUrl: restaurant.imageUrl,
      pointsPerCheckIn: restaurant.pointsPerCheckIn,
      distanceKm: distanceKm(latitude, longitude, restaurant.latitude, restaurant.longitude),
      ratingSummary: ratingSummary(reviews),
      menuId: menu?.id ?? null,
      menuName: menu?.name ?? `${restaurant.name} Menu`,
      menuItems: menuItems.map(menuItemData),
      isFavorite: favoriteIds.has(restaurant.id),
    };
  }

  async getDirections({ accessToken, restaurantId, latitude, longitude, platform }) {
    await this.getCurrentUser(accessToken);
    const restaurant = await this.getActiveRestaurant(restaurantId);
    const destination = `${restaurant.latitude},${restaurant.longitude}`;
    const origin =
      latitude === null || longitude === null ? null : `${latitude},${longitude}`;
    const normalizedPlatform = parsePlatform(platform ?? DEFAULT_PLATFORM);
    const providers = buildMapsUrls({
      origin,
      destination,
      platform: normalizedPlatform,
    });

    return {
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      address: restaurant.address,
      latitude: restaurant.latitude,
      longitude: restaurant.longitude,
      userLatitude: latitude,
      userLongitude: longitude,
      distanceKm: distanceKm(latitude, longitude, restaurant.latitude, restaurant.longitude),
      platform: normalizedPlatform,
      mapsUrl: providers.google.url,
      providers,
    };
  }

  filterRestaurants(records, { search, city }) {
    let filtered = records;
    if (city) {
      const needleCity = city.trim().toLowerCase();
      filtered = filtered.filter((record) => normalizeCity(record.city) === needleCity);
    }
    if (search) {
      const needle = search.trim().toLowerCase();
      filtered = filtered.filter((record) =>
        record.name.toLowerCase().includes(needle) ||
        record.address.toLowerCase().includes(needle) ||
        record.category.toLowerCase().includes(needle) ||
        normalizeCity(record.city).includes(needle),
      );
    }
    return filtered;
  }

  async buildListResponse({
    records,
    page,
    pageSize,
    latitude,
    longitude,
    favoriteIds,
    primaryRadiusKm,
    secondaryRadiusKm,
    enforceProximityBands = false,
    placementBoosts = null,
  }) {
    let items = await Promise.all(
      records.map(async (record) =>
        listItem(record, {
          latitude,
          longitude,
          reviews: await this.reviewRepository.listByRestaurant(record.id),
          isFavorite: favoriteIds.has(record.id),
        }),
      ),
    );
    let radiusKm = null;
    if (enforceProximityBands) {
      const primaryItems = items.filter(
        (item) => item.distanceKm !== null && item.distanceKm <= primaryRadiusKm,
      );
      const secondaryItems = items.filter(
        (item) => item.distanceKm !== null && item.distanceKm <= secondaryRadiusKm,
      );
      if (primaryItems.length) {
        items = primaryItems;
        radiusKm = primaryRadiusKm;
      } else {
        items = secondaryItems;
        radiusKm = secondaryRadiusKm;
      }
    }
    items.sort((left, right) => {
      // BR-011 — sponsored/featured/trending placements sort to the top
      // within their band. Items without a placement get tier 3 (lowest).
      const leftTier = placementTierFor(left, placementBoosts);
      const rightTier = placementTierFor(right, placementBoosts);
      if (leftTier !== rightTier) {
        return leftTier - rightTier;
      }
      if (left.distanceKm === null && right.distanceKm !== null) return 1;
      if (left.distanceKm !== null && right.distanceKm === null) return -1;
      if (left.distanceKm !== null && right.distanceKm !== null && left.distanceKm !== right.distanceKm) {
        return left.distanceKm - right.distanceKm;
      }
      return left.name.toLowerCase().localeCompare(right.name.toLowerCase());
    });
    const totalItems = items.length;
    const start = (page - 1) * pageSize;
    const outOfServiceArea =
      enforceProximityBands && items.length === 0;
    return {
      items: items.slice(start, start + pageSize),
      pagination: buildPaginationMeta({ page, pageSize, totalItems }),
      serviceArea: {
        activeCities: getActiveCityNames(this.geographyConfig),
        radiusKm,
        outOfServiceArea,
        message: outOfServiceArea ? outOfServiceMessage(this.geographyConfig) : null,
      },
    };
  }

  async favoriteIds(userId) {
    const records = await this.favoriteRepository.listByUser(userId);
    return new Set(records.map((record) => record.restaurantId));
  }

  async getActiveRestaurant(restaurantId) {
    const restaurant = await this.restaurantRepository.getById(restaurantId);
    if (!restaurant || restaurant.status !== 'active') {
      throw new ApplicationError({
        code: 'restaurant_not_found',
        message: 'No restaurant found for the provided identifier.',
        statusCode: 404,
      });
    }
    return restaurant;
  }

  async getCurrentUser(accessToken) {
    const user = await getAuthenticatedAccount({
      accessToken,
      identityProvider: this.identityProvider,
      userRepository: this.userRepository,
      notFoundCode: 'user_not_found',
      notFoundMessage: 'No end-user account found for the provided credentials.',
      notFoundStatusCode: 404,
    });
    return requireActiveRoles({
      record: user,
      allowedRoles: new Set(['user']),
      roleErrorCode: 'user_not_found',
      roleErrorMessage: 'No end-user account found for the provided credentials.',
      roleErrorStatusCode: 404,
      blockedErrorCode: 'user_blocked',
      blockedErrorMessage: 'The user account is blocked.',
    });
  }
}