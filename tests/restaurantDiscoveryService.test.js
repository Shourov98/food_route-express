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

  async getById(id) {
    return this.restaurants.find((record) => record.id === id) ?? null;
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

class FakeMenuRepository {
  async getByRestaurantId() {
    return null;
  }
}

class FakeMenuItemRepository {
  async listByMenuId() {
    return [];
  }
}

class FakePlacementRepository {
  constructor(byFeature = {}) {
    this.byFeature = byFeature;
  }

  async listByFeature(feature) {
    return this.byFeature[feature] ?? [];
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

function createService(restaurants, user = makeUser(), { placementRepository = null, menuRepository = null } = {}) {
  return new RestaurantDiscoveryService({
    restaurantRepository: new FakeRestaurantRepository(restaurants),
    menuRepository: menuRepository ?? new FakeMenuRepository(),
    menuItemRepository: new FakeMenuItemRepository(),
    reviewRepository: new FakeReviewRepository(),
    favoriteRepository: new FakeFavoriteRepository(),
    userRepository: new FakeUserRepository([user]),
    identityProvider: new FakeIdentityProvider(),
    placementRepository,
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

test('RestaurantDiscoveryService returns the full worldwide catalog when nearby location is absent', async () => {
  const service = createService([
    makeRestaurant('mexico', { city: 'Mexico City' }),
    makeRestaurant('monterrey', { city: 'Monterrey', latitude: 25.6866, longitude: -100.3161 }),
    makeRestaurant('dhaka', { city: 'Dhaka', latitude: 23.8103, longitude: 90.4125 }),
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

  // No lat/lng → no proximity band filtering; the entire worldwide catalog
  // is returned regardless of the user's profile city.
  const ids = result.items.map((item) => item.id).sort();
  assert.deepEqual(ids, ['dhaka', 'mexico', 'monterrey']);
  assert.equal(result.items.every((item) => item.distanceKm === null), true);
});

// ---------------------------------------------------------------------------
// Worldwide coverage — no active-city enforcement (per product decision:
// restaurants from any city worldwide are visible to all users).
// ---------------------------------------------------------------------------

test('listRestaurants returns the full active catalog for any city profile', async () => {
  const dhaka = makeRestaurant('dhaka', { city: 'Dhaka', latitude: 23.8103, longitude: 90.4125 });
  const mexico = makeRestaurant('mexico', { city: 'Mexico City' });
  const service = createService([dhaka, mexico], makeUser({ city: 'Dhaka' }));

  const result = await service.listRestaurants({
    accessToken: 'user-1',
    page: 1,
    pageSize: 10,
    search: null,
    city: null,
    latitude: null,
    longitude: null,
  });

  const ids = result.items.map((item) => item.id).sort();
  assert.deepEqual(ids, ['dhaka', 'mexico']);
});

test('listFeaturedRestaurants returns the full active catalog for any city profile', async () => {
  const dhaka = makeRestaurant('dhaka', { city: 'Dhaka' });
  const service = createService([dhaka], makeUser({ city: 'Dhaka' }));

  const result = await service.listFeaturedRestaurants({
    accessToken: 'user-1',
    page: 1,
    pageSize: 10,
    search: null,
    city: null,
    latitude: null,
    longitude: null,
  });

  assert.deepEqual(result.items.map((item) => item.id), ['dhaka']);
});

test('listNearbyRestaurants returns the full active catalog for any city profile', async () => {
  const dhaka = makeRestaurant('dhaka', { city: 'Dhaka', latitude: 23.8103, longitude: 90.4125 });
  const mexico = makeRestaurant('mexico', { city: 'Mexico City' });
  const service = createService([dhaka, mexico], makeUser({ city: 'Dhaka' }));

  const result = await service.listNearbyRestaurants({
    accessToken: 'user-1',
    page: 1,
    pageSize: 10,
    search: null,
    city: null,
    latitude: null,
    longitude: null,
  });

  // No lat/lng → no proximity band filtering, full catalog returned regardless of city.
  assert.equal(result.items.length, 2);
});

test('listRestaurants accepts any ?city= string (no allowlist enforced)', async () => {
  const dhaka = makeRestaurant('dhaka', { city: 'Dhaka' });
  const service = createService([dhaka]);

  const result = await service.listRestaurants({
    accessToken: 'user-1',
    page: 1,
    pageSize: 10,
    search: null,
    city: 'Karachi',
    latitude: null,
    longitude: null,
  });

  // search filter narrows to dhaka (name match)
  assert.deepEqual(result.items.map((item) => item.id), []);
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
  assert.deepEqual(
    result.serviceArea.activeCities,
    ['Mexico City', 'Monterrey', 'Guadalajara', 'Dhaka'],
  );
  assert.equal(result.serviceArea.message, null, 'no message when not out of service');
});

// ---------------------------------------------------------------------------
// BR-011 — placement boost + wide-radius filter
// ---------------------------------------------------------------------------

test('BR-011 listRestaurants boosts sponsored placement to the top within the band', async () => {
  // "close" is closer to the user but has no placement.
  // "sponsored" is slightly farther but has an active sponsored placement.
  const close = makeRestaurant('close', { latitude: 19.4327, longitude: -99.1333 });
  const sponsored = makeRestaurant('sponsored', { latitude: 19.435, longitude: -99.135 });
  const placementRepository = new FakePlacementRepository({
    sponsored: [{ id: 'pl-1', feature: 'sponsored', restaurantId: 'sponsored', active: true, sortOrder: 0 }],
  });
  const service = createService([close, sponsored], makeUser(), { placementRepository });

  const result = await service.listRestaurants({
    accessToken: 'user-1',
    page: 1,
    pageSize: 10,
    search: null,
    city: null,
    latitude: 19.4326,
    longitude: -99.1332,
  });
  assert.deepEqual(
    result.items.map((item) => item.id),
    ['sponsored', 'close'],
    'sponsored restaurant sorts ahead of closer un-placed restaurant',
  );
});

test('BR-011 listRestaurants falls back to closest-first when no placements', async () => {
  // Same setup as above, but no placementRepository: closest should win.
  const close = makeRestaurant('close', { latitude: 19.4327, longitude: -99.1333 });
  const far = makeRestaurant('far', { latitude: 19.435, longitude: -99.135 });
  const service = createService([close, far], makeUser(), { placementRepository: null });

  const result = await service.listRestaurants({
    accessToken: 'user-1',
    page: 1,
    pageSize: 10,
    search: null,
    city: null,
    latitude: 19.4326,
    longitude: -99.1332,
  });
  assert.deepEqual(result.items.map((item) => item.id), ['close', 'far']);
});

test('BR-011 listRestaurants treats inactive placements as no boost', async () => {
  const close = makeRestaurant('close', { latitude: 19.4327, longitude: -99.1333 });
  const far = makeRestaurant('far', { latitude: 19.435, longitude: -99.135 });
  const placementRepository = new FakePlacementRepository({
    sponsored: [{ id: 'pl-1', feature: 'sponsored', restaurantId: 'far', active: false, sortOrder: 0 }],
  });
  const service = createService([close, far], makeUser(), { placementRepository });

  const result = await service.listRestaurants({
    accessToken: 'user-1',
    page: 1,
    pageSize: 10,
    search: null,
    city: null,
    latitude: 19.4326,
    longitude: -99.1332,
  });
  assert.deepEqual(result.items.map((item) => item.id), ['close', 'far'],
    'inactive placement must not boost the restaurant');
});

test('BR-011 listNearbyRestaurants honours ?radius= query override', async () => {
  // "near" is 0.1 km away, "mid" is 8 km away. User has no proximityDistanceKm
  // (so default = 5 km), but the test passes radiusKm = 12 so "mid" is in band.
  const near = makeRestaurant('near', { latitude: 19.4326, longitude: -99.1332 });
  const mid = makeRestaurant('mid', { latitude: 19.49, longitude: -99.19 });
  const service = createService([near, mid], makeUser());

  const result = await service.listNearbyRestaurants({
    accessToken: 'user-1',
    page: 1,
    pageSize: 10,
    search: null,
    city: null,
    latitude: 19.4326,
    longitude: -99.1332,
    radiusKm: 12,
  });
  assert.equal(result.serviceArea.radiusKm, 12);
  assert.deepEqual(
    result.items.map((item) => item.id).sort(),
    ['mid', 'near'],
    '12 km override should include both restaurants',
  );
});

test('BR-011 parseRadius rejects non-numeric radius', async () => {
  const service = createService([makeRestaurant('mexico', { city: 'Mexico City' })]);
  assert.throws(
    () => service.parseRadius({ radius: 'abc' }),
    (err) => err instanceof ApplicationError && err.code === 'validation_error',
  );
});

test('BR-011 listNearbyRestaurants returns all package tiers and all cities worldwide', async () => {
  // Restaurants on every package tier AND every city worldwide should appear
  // in the nearby feed. Only the active status filter applies.
  const start = makeRestaurant('start', { currentPackage: 'start', city: 'Dhaka' });
  const active = makeRestaurant('active', { currentPackage: 'active', city: 'Tokyo' });
  const pro = makeRestaurant('pro', { currentPackage: 'pro', city: 'Berlin' });
  const prime = makeRestaurant('prime', { currentPackage: 'prime', city: 'Mexico City' });
  const dominio = makeRestaurant('dominio', { currentPackage: 'dominio', city: 'Lagos' });
  const service = createService([start, active, pro, prime, dominio], makeUser());

  const result = await service.listNearbyRestaurants({
    accessToken: 'user-1',
    page: 1,
    pageSize: 10,
    search: null,
    city: null,
    latitude: 19.4326,
    longitude: -99.1332,
  });

  const ids = result.items.map((item) => item.id).sort();
  assert.deepEqual(ids, ['active', 'dominio', 'prime', 'pro', 'start']);
});

test('BR-011 listRestaurants returns active restaurants from any city worldwide', async () => {
  const dhaka = makeRestaurant('dhaka', { city: 'Dhaka', latitude: 23.8103, longitude: 90.4125 });
  const tokyo = makeRestaurant('tokyo', { city: 'Tokyo', latitude: 35.6762, longitude: 139.6503 });
  const mexico = makeRestaurant('mexico', { city: 'Mexico City', latitude: 19.4326, longitude: -99.1332 });
  const service = createService([dhaka, tokyo, mexico], makeUser());

  const result = await service.listRestaurants({
    accessToken: 'user-1',
    page: 1,
    pageSize: 10,
    search: null,
    city: null,
  });

  const ids = result.items.map((item) => item.id).sort();
  assert.deepEqual(ids, ['dhaka', 'mexico', 'tokyo']);
});

// ---------------------------------------------------------------------------
// BR-012 — getDirections providers + getRestaurantMenu lat/lng
// ---------------------------------------------------------------------------

test('BR-012 getRestaurantMenu response includes latitude and longitude', async () => {
  const service = createService([makeRestaurant('mexico', { city: 'Mexico City' })]);

  const result = await service.getRestaurantMenu({
    accessToken: 'user-1',
    restaurantId: 'mexico',
    latitude: 19.4,
    longitude: -99.1,
  });
  assert.equal(result.latitude, 19.4326);
  assert.equal(result.longitude, -99.1332);
});

test('BR-012 getDirections returns google + apple + waze URLs (platform=ios)', async () => {
  const service = createService([makeRestaurant('mexico', { city: 'Mexico City' })]);

  const result = await service.getDirections({
    accessToken: 'user-1',
    restaurantId: 'mexico',
    latitude: 19.4,
    longitude: -99.1,
    platform: 'ios',
  });
  assert.equal(result.platform, 'ios');
  assert.match(result.providers.google.url, /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&origin=19\.4,-99\.1&destination=19\.4326,-99\.1332$/);
  assert.equal(result.providers.google.fallbackReason, null);
  assert.equal(result.providers.apple.url, 'maps://?daddr=19.4326,-99.1332&dirflg=d');
  assert.equal(result.providers.apple.fallbackReason, null);
  assert.equal(result.providers.waze.url, 'waze://?ll=19.4326,-99.1332&navigate=yes');
  assert.equal(result.providers.waze.fallbackReason, null);
  // Back-compat field still present.
  assert.equal(result.mapsUrl, result.providers.google.url);
});

test('BR-012 getDirections returns web fallback URLs with no_native_app (platform=web)', async () => {
  const service = createService([makeRestaurant('mexico', { city: 'Mexico City' })]);

  const result = await service.getDirections({
    accessToken: 'user-1',
    restaurantId: 'mexico',
    latitude: 19.4,
    longitude: -99.1,
    platform: 'web',
  });
  assert.equal(result.platform, 'web');
  assert.match(result.providers.apple.url, /^https:\/\/maps\.apple\.com\//);
  assert.equal(result.providers.apple.fallbackReason, 'no_native_app');
  assert.match(result.providers.waze.url, /^https:\/\/waze\.com\/ul\?/);
  assert.equal(result.providers.waze.fallbackReason, 'no_native_app');
  assert.equal(result.providers.google.fallbackReason, null);
});

test('BR-012 getDirections falls back to Google search URL when no origin', async () => {
  const service = createService([makeRestaurant('mexico', { city: 'Mexico City' })]);

  const result = await service.getDirections({
    accessToken: 'user-1',
    restaurantId: 'mexico',
    latitude: null,
    longitude: null,
    platform: 'ios',
  });
  assert.match(result.providers.google.url, /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=19\.4326,-99\.1332$/);
});

test('BR-012 getDirections defaults platform to web', async () => {
  const service = createService([makeRestaurant('mexico', { city: 'Mexico City' })]);

  const result = await service.getDirections({
    accessToken: 'user-1',
    restaurantId: 'mexico',
    latitude: 19.4,
    longitude: -99.1,
    platform: undefined,
  });
  assert.equal(result.platform, 'web');
  assert.equal(result.providers.apple.fallbackReason, 'no_native_app');
});
