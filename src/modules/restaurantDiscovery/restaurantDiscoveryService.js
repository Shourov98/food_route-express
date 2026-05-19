import { ApplicationError, validationError } from '../../core/ApplicationError.js';
import { getAuthenticatedAccount, requireActiveRoles } from '../../shared/auth/authorization.js';
import { buildPaginationMeta } from '../../shared/pagination.js';

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

function supportsFeature(record, featureKey) {
  const matrix = {
    featuredListing: new Set(['pro', 'prime', 'dominio']),
    proximityAlerts: new Set(['prime', 'dominio']),
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

export class RestaurantDiscoveryService {
  constructor({
    restaurantRepository,
    menuRepository,
    menuItemRepository,
    reviewRepository,
    favoriteRepository,
    userRepository,
    identityProvider,
  }) {
    this.restaurantRepository = restaurantRepository;
    this.menuRepository = menuRepository;
    this.menuItemRepository = menuItemRepository;
    this.reviewRepository = reviewRepository;
    this.favoriteRepository = favoriteRepository;
    this.userRepository = userRepository;
    this.identityProvider = identityProvider;
  }

  parseLocation(query) {
    return {
      latitude: parseNumber(query.latitude),
      longitude: parseNumber(query.longitude),
    };
  }

  async listRestaurants({ accessToken, page, pageSize, search, city, latitude, longitude }) {
    const user = await this.getCurrentUser(accessToken);
    const favoriteIds = await this.favoriteIds(user.uid);
    let records = (await this.restaurantRepository.listAll()).filter((record) => record.status === 'active');
    records = this.filterRestaurants(records, { search, city });
    return this.buildListResponse({ records, page, pageSize, latitude, longitude, favoriteIds });
  }

  async listFeaturedRestaurants({ accessToken, page, pageSize, search, city, latitude, longitude }) {
    const user = await this.getCurrentUser(accessToken);
    const favoriteIds = await this.favoriteIds(user.uid);
    let records = (await this.restaurantRepository.listAll()).filter(
      (record) => record.status === 'active' && supportsFeature(record, 'featuredListing'),
    );
    records = this.filterRestaurants(records, { search, city });
    return this.buildListResponse({ records, page, pageSize, latitude, longitude, favoriteIds });
  }

  async listNearbyRestaurants({ accessToken, page, pageSize, search, city, latitude, longitude }) {
    const user = await this.getCurrentUser(accessToken);
    const favoriteIds = await this.favoriteIds(user.uid);
    let records = (await this.restaurantRepository.listAll()).filter(
      (record) => record.status === 'active' && supportsFeature(record, 'proximityAlerts'),
    );
    records = this.filterRestaurants(records, { search, city });
    return this.buildListResponse({ records, page, pageSize, latitude, longitude, favoriteIds });
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

  async getDirections({ accessToken, restaurantId, latitude, longitude }) {
    await this.getCurrentUser(accessToken);
    const restaurant = await this.getActiveRestaurant(restaurantId);
    const destination = `${restaurant.latitude},${restaurant.longitude}`;
    const origin =
      latitude === null || longitude === null ? null : `${latitude},${longitude}`;

    return {
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      address: restaurant.address,
      latitude: restaurant.latitude,
      longitude: restaurant.longitude,
      userLatitude: latitude,
      userLongitude: longitude,
      distanceKm: distanceKm(latitude, longitude, restaurant.latitude, restaurant.longitude),
      mapsUrl: origin
        ? `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`
        : `https://www.google.com/maps/search/?api=1&query=${destination}`,
    };
  }

  filterRestaurants(records, { search, city }) {
    let filtered = records;
    if (city) {
      const needleCity = city.trim().toLowerCase();
      filtered = filtered.filter((record) => (record.city ?? '').toLowerCase() === needleCity);
    }
    if (search) {
      const needle = search.trim().toLowerCase();
      filtered = filtered.filter((record) =>
        record.name.toLowerCase().includes(needle) ||
        record.address.toLowerCase().includes(needle) ||
        record.category.toLowerCase().includes(needle) ||
        (record.city ?? '').toLowerCase().includes(needle),
      );
    }
    return filtered;
  }

  async buildListResponse({ records, page, pageSize, latitude, longitude, favoriteIds }) {
    const items = await Promise.all(
      records.map(async (record) =>
        listItem(record, {
          latitude,
          longitude,
          reviews: await this.reviewRepository.listByRestaurant(record.id),
          isFavorite: favoriteIds.has(record.id),
        }),
      ),
    );
    items.sort((left, right) => {
      if (left.distanceKm === null && right.distanceKm !== null) return 1;
      if (left.distanceKm !== null && right.distanceKm === null) return -1;
      if (left.distanceKm !== null && right.distanceKm !== null && left.distanceKm !== right.distanceKm) {
        return left.distanceKm - right.distanceKm;
      }
      return left.name.toLowerCase().localeCompare(right.name.toLowerCase());
    });
    const totalItems = items.length;
    const start = (page - 1) * pageSize;
    return {
      items: items.slice(start, start + pageSize),
      pagination: buildPaginationMeta({ page, pageSize, totalItems }),
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
