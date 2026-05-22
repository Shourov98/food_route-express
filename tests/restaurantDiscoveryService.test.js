import assert from 'node:assert/strict';
import test from 'node:test';

import { RestaurantDiscoveryService } from '../src/modules/restaurantDiscovery/restaurantDiscoveryService.js';

class FakeIdentityProvider {
  async verifyIdToken(token) {
    return { uid: token };
  }
}

class FakeUserRepository {
  constructor(users) {
    this.users = new Map(users.map((user) => [user.uid, user]));
  }

  async getByUid(uid) {
    return this.users.get(uid) ?? null;
  }
}

class FakeRestaurantRepository {
  constructor(restaurants) {
    this.restaurants = restaurants;
  }

  async listAll() {
    return this.restaurants;
  }
}

class FakeReviewRepository {
  async listByRestaurant() {
    return [];
  }
}

class FakeFavoriteRepository {
  async listByUser() {
    return [];
  }
}

function makeUser(overrides = {}) {
  return {
    uid: 'user-1',
    fullname: 'Nearby User',
    email: 'nearby@example.com',
    city: 'Dhaka',
    role: 'user',
    isBlocked: false,
    isVerified: true,
    ...overrides,
  };
}

function makeRestaurant(id, overrides = {}) {
  return {
    id,
    name: id,
    address: 'Restaurant address',
    city: 'Dhaka',
    latitude: 23.8,
    longitude: 90.4,
    category: 'Cafe',
    imageUrl: null,
    pointsPerCheckIn: 20,
    currentPackage: 'prime',
    status: 'active',
    ...overrides,
  };
}

function createService(restaurants, user = makeUser()) {
  return new RestaurantDiscoveryService({
    restaurantRepository: new FakeRestaurantRepository(restaurants),
    menuRepository: null,
    menuItemRepository: null,
    reviewRepository: new FakeReviewRepository(),
    favoriteRepository: new FakeFavoriteRepository(),
    userRepository: new FakeUserRepository([user]),
    identityProvider: new FakeIdentityProvider(),
  });
}

test('RestaurantDiscoveryService sorts nearby restaurants by distance when coordinates are present', async () => {
  const service = createService([
    makeRestaurant('far', { latitude: 23.9, longitude: 90.5 }),
    makeRestaurant('near', { latitude: 23.8005, longitude: 90.4005 }),
  ]);

  const result = await service.listNearbyRestaurants({
    accessToken: 'user-1',
    page: 1,
    pageSize: 10,
    search: null,
    city: null,
    latitude: 23.8,
    longitude: 90.4,
  });

  assert.deepEqual(result.items.map((item) => item.id), ['near', 'far']);
  assert.equal(result.items.every((item) => item.distanceKm !== null), true);
});

test('RestaurantDiscoveryService falls back to the user city when nearby location is absent', async () => {
  const service = createService([
    makeRestaurant('dhaka', { city: 'Dhaka' }),
    makeRestaurant('chattogram', { city: 'Chattogram', latitude: 22.36, longitude: 91.78 }),
  ]);

  const result = await service.listNearbyRestaurants({
    accessToken: 'user-1',
    page: 1,
    pageSize: 10,
    search: null,
    city: null,
    latitude: null,
    longitude: null,
  });

  assert.deepEqual(result.items.map((item) => item.id), ['dhaka']);
  assert.equal(result.items[0].distanceKm, null);
});

