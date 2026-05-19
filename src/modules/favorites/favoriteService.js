import { ApplicationError } from '../../core/ApplicationError.js';
import { getAuthenticatedAccount, requireActiveRoles } from '../../shared/auth/authorization.js';
import { buildPaginationMeta } from '../../shared/pagination.js';
import { buildUserFavoriteRestaurantRecordId } from './favoriteRepository.js';

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
  if (reviews.length === 0) {
    return { averageRating: 0, totalReviews: 0 };
  }
  const average = Math.round((reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length) * 100) / 100;
  return { averageRating: average, totalReviews: reviews.length };
}

function favoriteRestaurantItem(record, { latitude, longitude, reviews }) {
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
    isFavorite: true,
  };
}

export class FavoriteService {
  constructor({
    favoriteRepository,
    restaurantRepository,
    reviewRepository,
    userRepository,
    identityProvider,
  }) {
    this.favoriteRepository = favoriteRepository;
    this.restaurantRepository = restaurantRepository;
    this.reviewRepository = reviewRepository;
    this.userRepository = userRepository;
    this.identityProvider = identityProvider;
  }

  async listFavoriteRestaurants({
    accessToken,
    page,
    pageSize,
    search,
    city,
    latitude,
    longitude,
  }) {
    const user = await this.getCurrentUser(accessToken);
    const favoriteRecords = await this.favoriteRepository.listByUser(user.uid);
    let restaurants = (
      await Promise.all(favoriteRecords.map((favorite) => this.restaurantRepository.getById(favorite.restaurantId)))
    ).filter((restaurant) => restaurant && restaurant.status === 'active');

    if (city) {
      const needleCity = city.toLowerCase();
      restaurants = restaurants.filter((restaurant) => (restaurant.city ?? '').toLowerCase() === needleCity);
    }

    if (search) {
      const needle = search.toLowerCase();
      restaurants = restaurants.filter((restaurant) =>
        restaurant.name.toLowerCase().includes(needle) ||
        restaurant.address.toLowerCase().includes(needle) ||
        restaurant.category.toLowerCase().includes(needle) ||
        (restaurant.city ?? '').toLowerCase().includes(needle),
      );
    }

    const items = await Promise.all(
      restaurants.map(async (restaurant) =>
        favoriteRestaurantItem(restaurant, {
          latitude,
          longitude,
          reviews: await this.reviewRepository.listByRestaurant(restaurant.id),
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

  async toggleFavoriteRestaurant({ accessToken, restaurantId }) {
    const user = await this.getCurrentUser(accessToken);
    const existing = await this.favoriteRepository.getByUserAndRestaurant(user.uid, restaurantId);
    if (existing) {
      await this.favoriteRepository.delete(user.uid, restaurantId);
      return false;
    }

    const restaurant = await this.restaurantRepository.getById(restaurantId);
    if (!restaurant || restaurant.status !== 'active') {
      throw new ApplicationError({
        code: 'restaurant_not_found',
        message: 'No restaurant found for the provided identifier.',
        statusCode: 404,
      });
    }

    const now = new Date();
    await this.favoriteRepository.create({
      id: buildUserFavoriteRestaurantRecordId(user.uid, restaurantId),
      userId: user.uid,
      restaurantId,
      createdAt: now,
      updatedAt: now,
    });
    return true;
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
