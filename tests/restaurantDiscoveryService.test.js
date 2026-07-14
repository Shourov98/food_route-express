import assert from 'node:assert/strict';
import test from 'node:test';

import { ApplicationError } from '../src/core/ApplicationError.js';
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

// ---------------------------------------------------------------------------
// BR-010 — out_of_service_area error path
// ---------------------------------------------------------------------------

test('BR-010 listRestaurants throws out_of_service_area when ?city= is not in allowlist', async () => {
  const service = createService([makeRestaurant('mexico', { city: 'Mexico City' })]);

  await assert.rejects(
    service.listRestaurants({
      accessToken: 'user-1',
      page: 1,
      pageSize: 10,
      search: null,
      city: 'Karachi',
      latitude: null,
      longitude: null,
    }),
    (err) => {
      assert.ok(err instanceof ApplicationError);
      assert.equal(err.code, 'out_of_service_area');
      assert.equal(err.statusCode, 404);
      assert.deepEqual(err.details.activeCities, ['Mexico City', 'Monterrey', 'Guadalajara']);
      assert.equal(err.details.requestedCity, 'Karachi');
      return true;
    },
  );
});

test('BR-010 listFeaturedRestaurants throws out_of_service_area when ?city= is not in allowlist', async () => {
  const service = createService([makeRestaurant('mexico', { city: 'Mexico City' })]);

  await assert.rejects(
    service.listFeaturedRestaurants({
      accessToken: 'user-1',
      page: 1,
      pageSize: 10,
      search: null,
      city: 'Dhaka',
      latitude: null,
      longitude: null,
    }),
    (err) => err instanceof ApplicationError && err.code === 'out_of_service_area',
  );
});

test('BR-010 listNearbyRestaurants throws out_of_service_area when ?city= is not in allowlist', async () => {
  const service = createService([makeRestaurant('mexico', { city: 'Mexico City' })]);

  await assert.rejects(
    service.listNearbyRestaurants({
      accessToken: 'user-1',
      page: 1,
      pageSize: 10,
      search: null,
      city: 'Singapore',
      latitude: 19.4,
      longitude: -99.1,
    }),
    (err) => err instanceof ApplicationError && err.code === 'out_of_service_area',
  );
});

test('BR-010 listRestaurants throws out_of_service_area when user.city is non-active and no lat/lng supplied', async () => {
  const service = createService(
    [makeRestaurant('mexico', { city: 'Mexico City' })],
    makeUser({ uid: 'user-1', city: 'Dhaka' }),
  );

  await assert.rejects(
    service.listRestaurants({
      accessToken: 'user-1',
      page: 1,
      pageSize: 10,
      search: null,
      city: null,
      latitude: null,
      longitude: null,
    }),
    (err) => {
      assert.ok(err instanceof ApplicationError);
      assert.equal(err.code, 'out_of_service_area');
      assert.equal(err.details.profileCity, 'Dhaka');
      return true;
    },
  );
});

test('BR-010 listRestaurants succeeds when user.city is non-active but lat/lng are supplied', async () => {
  // No hard error — the soft serviceArea flag will be set when applicable.
  const service = createService(
    [makeRestaurant('mexico', { city: 'Mexico City' })],
    makeUser({ uid: 'user-1', city: 'Dhaka' }),
  );

  const result = await service.listRestaurants({
    accessToken: 'user-1',
    page: 1,
    pageSize: 10,
    search: null,
    city: null,
    latitude: 19.4,
    longitude: -99.1,
  });
  assert.equal(result.serviceArea.outOfServiceArea, false);
});

test('BR-010 listRestaurants accepts ?city=Mexico City (active)', async () => {
  const service = createService([makeRestaurant('mexico', { city: 'Mexico City' })]);

  const result = await service.listRestaurants({
    accessToken: 'user-1',
    page: 1,
    pageSize: 10,
    search: null,
    city: 'Mexico City',
    latitude: null,
    longitude: null,
  });
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].id, 'mexico');
});

// ---------------------------------------------------------------------------
// BR-009 — radius is the user's main operating unit
// ---------------------------------------------------------------------------

test('BR-009 listNearbyRestaurants honours user.proximityDistanceKm when set', async () => {
  // User's radius is 2 km. Restaurant "far" is 12 km away, restaurant
  // "near" is 0.1 km away. With radius=2 km only "near" qualifies.
  const service = createService([
    makeRestaurant('near', { latitude: 19.4326, longitude: -99.1332 }),
    makeRestaurant('far', { latitude: 19.55, longitude: -99.25 }),
  ]);
  // Inject a user with a 2 km radius.
  const user = makeUser({ uid: 'user-1', proximityDistanceKm: 2 });

  // Override the userRepository to return our custom user.
  const customService = new RestaurantDiscoveryService({
    restaurantRepository: new FakeRestaurantRepository([
      makeRestaurant('near', { latitude: 19.4326, longitude: -99.1332 }),
      makeRestaurant('far', { latitude: 19.55, longitude: -99.25 }),
    ]),
    menuRepository: null,
    menuItemRepository: null,
    reviewRepository: new FakeReviewRepository(),
    favoriteRepository: new FakeFavoriteRepository(),
    userRepository: new FakeUserRepository([user]),
    identityProvider: new FakeIdentityProvider(),
  });

  const result = await customService.listNearbyRestaurants({
    accessToken: 'user-1',
    page: 1,
    pageSize: 10,
    search: null,
    city: null,
    latitude: 19.4326,
    longitude: -99.1332,
  });
  // Only "near" should be inside the user's 2 km primary radius.
  assert.equal(result.serviceArea.radiusKm, 2, 'primary radius = user.proximityDistanceKm');
  assert.deepEqual(result.items.map((item) => item.id), ['near']);
});

test('BR-009 listNearbyRestaurants falls back to 5 km default when user has no setting', async () => {
  // Build a service with a user that has proximityDistanceKm=null.
  const user = makeUser({ uid: 'user-1', proximityDistanceKm: null });
  const customService = new RestaurantDiscoveryService({
    restaurantRepository: new FakeRestaurantRepository([
      makeRestaurant('near', { latitude: 19.4326, longitude: -99.1332 }),
      makeRestaurant('far', { latitude: 19.55, longitude: -99.25 }),
    ]),
    menuRepository: null,
    menuItemRepository: null,
    reviewRepository: new FakeReviewRepository(),
    favoriteRepository: new FakeFavoriteRepository(),
    userRepository: new FakeUserRepository([user]),
    identityProvider: new FakeIdentityProvider(),
  });

  const result = await customService.listNearbyRestaurants({
    accessToken: 'user-1',
    page: 1,
    pageSize: 10,
    search: null,
    city: null,
    latitude: 19.4326,
    longitude: -99.1332,
  });
  assert.equal(result.serviceArea.radiusKm, 5, 'default radius is 5 km when user has no setting');
});

test('BR-010 listRestaurants response always includes activeCities in serviceArea', async () => {
  const service = createService([makeRestaurant('mexico', { city: 'Mexico City' })]);

  const result = await service.listRestaurants({
    accessToken: 'user-1',
    page: 1,
    pageSize: 10,
    search: null,
    city: null,
    latitude: null,
    longitude: null,
  });
  assert.deepEqual(result.serviceArea.activeCities, ['Mexico City', 'Monterrey', 'Guadalajara']);
  assert.equal(result.serviceArea.message, null, 'no message when not out of service');
});
