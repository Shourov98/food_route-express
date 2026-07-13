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
    city: 'Mexico City',
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
    city: 'Mexico City',
    latitude: 19.4326,
    longitude: -99.1332,
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
    makeRestaurant('far', { latitude: 19.52, longitude: -99.2 }),
    makeRestaurant('near', { latitude: 19.433, longitude: -99.133 }),
  ]);

  const result = await service.listNearbyRestaurants({
    accessToken: 'user-1',
    page: 1,
    pageSize: 10,
    search: null,
    city: null,
    latitude: 19.4326,
    longitude: -99.1332,
  });

  assert.deepEqual(result.items.map((item) => item.id), ['near']);
  assert.equal(result.items.every((item) => item.distanceKm !== null), true);
  assert.equal(result.serviceArea.radiusKm, 5);
});

test('RestaurantDiscoveryService falls back to the user city when nearby location is absent', async () => {
  const service = createService([
    makeRestaurant('mexico', { city: 'Mexico City' }),
    makeRestaurant('monterrey', { city: 'Monterrey', latitude: 25.6866, longitude: -100.3161 }),
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

  assert.deepEqual(result.items.map((item) => item.id), ['mexico']);
  assert.equal(result.items[0].distanceKm, null);
});
