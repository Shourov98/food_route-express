import assert from 'node:assert/strict';
import test from 'node:test';

import { PlacementService } from '../src/modules/placements/placementService.js';
import { RouteService } from '../src/modules/routes/routeService.js';

class FakeUserRepository {
  constructor(users) {
    this.users = new Map(users.map((user) => [user.uid, user]));
  }

  async getByUid(uid) {
    return this.users.get(uid) ?? null;
  }
}

class FakeRestaurantRepository {
  constructor(records = []) {
    this.records = new Map(records.map((record) => [record.id, record]));
  }

  async getById(id) {
    return this.records.get(id) ?? null;
  }

  async listAll() {
    return [...this.records.values()];
  }
}

class FakeRouteRepository {
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

  async listAll() {
    return [...this.records.values()];
  }

  async delete(id) {
    return this.records.delete(id);
  }
}

class FakePlacementRepository {
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

  async delete(id) {
    return this.records.delete(id);
  }

  async getById(id) {
    return this.records.get(id) ?? null;
  }

  async listByFeature(feature) {
    return [...this.records.values()].filter((record) => record.feature === feature);
  }

  async getByFeatureAndRestaurant({ feature, restaurantId }) {
    return (
      [...this.records.values()].find(
        (record) => record.feature === feature && record.restaurantId === restaurantId,
      ) ?? null
    );
  }
}

class FakeIdentityProvider {
  async verifyIdToken(token) {
    return { uid: token };
  }
}

function makeRestaurant(overrides = {}) {
  return {
    id: 'restaurant-1',
    name: 'Cafe One',
    address: '123 Main Street',
    city: 'Dhaka',
    latitude: 23.7,
    longitude: 90.4,
    category: 'Cafe',
    imageUrl: null,
    status: 'active',
    currentPackage: 'dominio',
    billingCycle: 'annual',
    ...overrides,
  };
}

test('RouteService creates route with route-enabled restaurants', async () => {
  const service = new RouteService({
    routeRepository: new FakeRouteRepository(),
    restaurantRepository: new FakeRestaurantRepository([
      makeRestaurant(),
      makeRestaurant({ id: 'restaurant-2', name: 'Cafe Two' }),
    ]),
    userRepository: new FakeUserRepository([
      { uid: 'admin-1', role: 'admin', isBlocked: false },
    ]),
    identityProvider: new FakeIdentityProvider(),
  });

  const result = await service.createRoute({
    accessToken: 'admin-1',
    payload: {
      routeName: 'Dhaka Trail',
      description: 'A city route',
      city: 'Dhaka',
      restaurantIds: ['restaurant-1', 'restaurant-2'],
      status: 'draft',
    },
  });

  assert.equal(result.routeName, 'Dhaka Trail');
  assert.equal(result.restaurantCount, 2);
});

test('RouteService lists active city-matched routes for users', async () => {
  const service = new RouteService({
    routeRepository: new FakeRouteRepository([
      {
        id: 'route-1',
        routeName: 'Dhaka Trail',
        description: 'A city route',
        city: 'Dhaka',
        restaurantIds: ['restaurant-1'],
        status: 'active',
        createdBy: 'admin-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'route-2',
        routeName: 'Chattogram Trail',
        description: 'Another route',
        city: 'Chattogram',
        restaurantIds: ['restaurant-1'],
        status: 'active',
        createdBy: 'admin-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]),
    restaurantRepository: new FakeRestaurantRepository([makeRestaurant()]),
    userRepository: new FakeUserRepository([
      { uid: 'user-1', role: 'user', isBlocked: false, city: 'Dhaka' },
    ]),
    identityProvider: new FakeIdentityProvider(),
  });

  const result = await service.listMyRoutes({
    accessToken: 'user-1',
    page: 1,
    pageSize: 10,
    search: null,
  });

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].id, 'route-1');
});

test('PlacementService assigns placement for eligible restaurant package', async () => {
  const service = new PlacementService({
    placementRepository: new FakePlacementRepository(),
    restaurantRepository: new FakeRestaurantRepository([makeRestaurant({ currentPackage: 'dominio' })]),
    userRepository: new FakeUserRepository([
      { uid: 'admin-1', role: 'admin', isBlocked: false },
    ]),
    identityProvider: new FakeIdentityProvider(),
  });

  const result = await service.assignPlacement({
    accessToken: 'admin-1',
    payload: {
      feature: 'sponsored',
      restaurantId: 'restaurant-1',
      sortOrder: 1,
      active: true,
    },
  });

  assert.equal(result.feature, 'sponsored');
  assert.equal(result.restaurantId, 'restaurant-1');
});
