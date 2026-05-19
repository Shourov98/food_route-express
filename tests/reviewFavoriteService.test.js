import assert from 'node:assert/strict';
import test from 'node:test';

import { FavoriteService } from '../src/modules/favorites/favoriteService.js';
import { buildUserFavoriteRestaurantRecordId } from '../src/modules/favorites/favoriteRepository.js';
import { ReviewService } from '../src/modules/reviews/reviewService.js';

class FakeIdentityProvider {
  async verifyIdToken(token) {
    return { uid: token };
  }
}

class FakeUserRepository {
  constructor(users = []) {
    this.users = new Map(users.map((user) => [user.uid, user]));
  }

  async getByUid(uid) {
    return this.users.get(uid) ?? null;
  }
}

class FakeRestaurantRepository {
  constructor(restaurants = []) {
    this.restaurants = new Map(restaurants.map((restaurant) => [restaurant.id, restaurant]));
  }

  async getById(id) {
    return this.restaurants.get(id) ?? null;
  }
}

class FakeReviewRepository {
  constructor(records = []) {
    this.records = new Map(records.map((record) => [record.id, record]));
  }

  async create(record) {
    this.records.set(record.id, record);
    return record;
  }

  async update(id, record) {
    this.records.set(id, record);
    return record;
  }

  async getById(id) {
    return this.records.get(id) ?? null;
  }

  async getByUserAndRestaurant({ userId, restaurantId }) {
    return (
      [...this.records.values()].find(
        (record) => record.userId === userId && record.restaurantId === restaurantId,
      ) ?? null
    );
  }

  async listByRestaurant(restaurantId) {
    return [...this.records.values()]
      .filter((record) => record.restaurantId === restaurantId)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  }

  async delete(id) {
    return this.records.delete(id);
  }
}

class FakeFavoriteRepository {
  constructor(records = []) {
    this.records = new Map(records.map((record) => [record.id, record]));
  }

  async create(record) {
    this.records.set(record.id, record);
    return record;
  }

  async delete(userId, restaurantId) {
    return this.records.delete(buildUserFavoriteRestaurantRecordId(userId, restaurantId));
  }

  async getByUserAndRestaurant(userId, restaurantId) {
    return this.records.get(buildUserFavoriteRestaurantRecordId(userId, restaurantId)) ?? null;
  }

  async listByUser(userId) {
    return [...this.records.values()]
      .filter((record) => record.userId === userId)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  }
}

function makeUser(overrides = {}) {
  return {
    uid: 'user-1',
    fullname: 'Jane Doe',
    email: 'jane@example.com',
    role: 'user',
    isBlocked: false,
    isVerified: true,
    ...overrides,
  };
}

function makeRestaurant(overrides = {}) {
  return {
    id: 'restaurant-1',
    name: 'Route Cafe',
    address: '123 Main Street',
    city: 'Dhaka',
    latitude: 23.81,
    longitude: 90.41,
    category: 'Cafe',
    imageUrl: null,
    pointsPerCheckIn: 25,
    status: 'active',
    ...overrides,
  };
}

test('ReviewService creates, lists, updates, and deletes reviews with parity rules', async () => {
  const reviewRepository = new FakeReviewRepository();
  const service = new ReviewService({
    reviewRepository,
    restaurantRepository: new FakeRestaurantRepository([makeRestaurant()]),
    userRepository: new FakeUserRepository([makeUser(), makeUser({ uid: 'admin-1', role: 'admin' })]),
    identityProvider: new FakeIdentityProvider(),
  });

  const created = await service.createReview({
    accessToken: 'user-1',
    restaurantId: 'restaurant-1',
    payload: { rating: 5, comment: 'Excellent' },
  });
  assert.equal(created.restaurantId, 'restaurant-1');
  assert.equal(created.rating, 5);

  const listed = await service.listReviews({
    accessToken: 'admin-1',
    restaurantId: 'restaurant-1',
    page: 1,
    pageSize: 10,
  });
  assert.equal(listed.items.length, 1);

  const updated = await service.updateReview({
    accessToken: 'user-1',
    restaurantId: 'restaurant-1',
    reviewId: created.id,
    payload: { rating: 4, comment: 'Still good', hasRatingField: true, hasCommentField: true },
  });
  assert.equal(updated.rating, 4);
  assert.equal(updated.comment, 'Still good');

  await service.deleteReview({
    accessToken: 'user-1',
    restaurantId: 'restaurant-1',
    reviewId: created.id,
  });
  assert.equal(await reviewRepository.getById(created.id), null);
});

test('ReviewService rejects duplicate reviews and owner mismatches', async () => {
  const reviewRepository = new FakeReviewRepository([
    {
      id: 'review-1',
      restaurantId: 'restaurant-1',
      userId: 'user-1',
      userFullname: 'Jane Doe',
      userEmail: 'jane@example.com',
      rating: 5,
      comment: 'Great',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    },
  ]);
  const service = new ReviewService({
    reviewRepository,
    restaurantRepository: new FakeRestaurantRepository([makeRestaurant()]),
    userRepository: new FakeUserRepository([makeUser(), makeUser({ uid: 'user-2', fullname: 'John Roe' })]),
    identityProvider: new FakeIdentityProvider(),
  });

  await assert.rejects(
    service.createReview({
      accessToken: 'user-1',
      restaurantId: 'restaurant-1',
      payload: { rating: 4, comment: 'Again' },
    }),
    (error) => error.code === 'review_already_exists' && error.statusCode === 409,
  );

  await assert.rejects(
    service.updateReview({
      accessToken: 'user-2',
      restaurantId: 'restaurant-1',
      reviewId: 'review-1',
      payload: { rating: 3, hasRatingField: true, hasCommentField: false },
    }),
    (error) =>
      error.code === 'review_not_found' &&
      error.message === 'This review belongs to Jane Doe.' &&
      error.statusCode === 404,
  );
});

test('FavoriteService lists and toggles favorite restaurants with review summaries', async () => {
  const favoriteRepository = new FakeFavoriteRepository([
    {
      id: buildUserFavoriteRestaurantRecordId('user-1', 'restaurant-1'),
      userId: 'user-1',
      restaurantId: 'restaurant-1',
      createdAt: new Date('2026-01-02T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    },
  ]);
  const service = new FavoriteService({
    favoriteRepository,
    restaurantRepository: new FakeRestaurantRepository([makeRestaurant()]),
    reviewRepository: new FakeReviewRepository([
      {
        id: 'review-1',
        restaurantId: 'restaurant-1',
        userId: 'user-2',
        userFullname: 'John Roe',
        userEmail: 'john@example.com',
        rating: 4,
        comment: 'Nice',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]),
    userRepository: new FakeUserRepository([makeUser()]),
    identityProvider: new FakeIdentityProvider(),
  });

  const listed = await service.listFavoriteRestaurants({
    accessToken: 'user-1',
    page: 1,
    pageSize: 10,
    search: null,
    city: null,
    latitude: 23.8,
    longitude: 90.4,
  });
  assert.equal(listed.items.length, 1);
  assert.equal(listed.items[0].isFavorite, true);
  assert.equal(listed.items[0].ratingSummary.averageRating, 4);

  const removed = await service.toggleFavoriteRestaurant({
    accessToken: 'user-1',
    restaurantId: 'restaurant-1',
  });
  assert.equal(removed, false);

  const added = await service.toggleFavoriteRestaurant({
    accessToken: 'user-1',
    restaurantId: 'restaurant-1',
  });
  assert.equal(added, true);
});
