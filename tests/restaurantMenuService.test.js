import assert from 'node:assert/strict';
import test from 'node:test';

import { MenuService } from '../src/modules/menus/menuService.js';
import { RestaurantService } from '../src/modules/restaurants/restaurantService.js';

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

class FakeMenuRepository {
  constructor(records = []) {
    this.records = new Map(records.map((record) => [record.id, record]));
  }

  async create(record) {
    this.records.set(record.id, record);
    return record;
  }

  async getByRestaurantId(restaurantId) {
    return [...this.records.values()].find((record) => record.restaurantId === restaurantId) ?? null;
  }
}

class FakeMenuItemRepository {
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

  async listByMenuId(menuId) {
    return [...this.records.values()].filter((record) => record.menuId === menuId);
  }

  async delete(id) {
    return this.records.delete(id);
  }
}

class FakeCheckInRepository {
  constructor(records = []) {
    this.records = records;
  }

  async listAll() {
    return this.records;
  }
}

class FakeIdentityProvider {
  async verifyIdToken(token) {
    return { uid: token };
  }
}

class FakeImageStorage {
  constructor() {
    this.uploads = [];
  }

  async uploadImage({ folder, file }) {
    this.uploads.push({ folder, file });
    return { publicUrl: `https://cdn.example.com/${folder}/${file.originalname}` };
  }
}

function makeUser(overrides = {}) {
  return {
    uid: 'admin-1',
    fullname: 'Admin',
    email: 'admin@example.com',
    role: 'admin',
    isBlocked: false,
    ...overrides,
  };
}

function createServices({ checkins = [] } = {}) {
  const userRepository = new FakeUserRepository([
    makeUser(),
    makeUser({ uid: 'user-1', role: 'user', email: 'user@example.com' }),
  ]);
  const restaurantRepository = new FakeRestaurantRepository();
  const menuRepository = new FakeMenuRepository();
  const menuItemRepository = new FakeMenuItemRepository();
  const identityProvider = new FakeIdentityProvider();
  const imageStorage = new FakeImageStorage();

  const menuService = new MenuService({
    menuRepository,
    menuItemRepository,
    restaurantRepository,
    userRepository,
    identityProvider,
    imageStorage,
  });
  const restaurantService = new RestaurantService({
    restaurantRepository,
    checkinRepository: new FakeCheckInRepository(checkins),
    menuService,
    userRepository,
    identityProvider,
    imageStorage,
  });

  return {
    restaurantService,
    menuService,
    restaurantRepository,
    menuRepository,
    menuItemRepository,
  };
}

test('RestaurantService creates restaurant and default menu', async () => {
  const { restaurantService, menuRepository } = createServices();

  const result = await restaurantService.createRestaurant({
    accessToken: 'admin-1',
    payload: {
      name: 'Cafe One',
      address: '123 Main Street',
      city: 'Dhaka',
      latitude: 23.7,
      longitude: 90.4,
      category: 'Cafe',
      openingTime: '08:00',
      closingTime: '22:00',
      qrCode: {
        name: 'Cafe One QR',
        location: { latitude: 23.7, longitude: 90.4 },
        token: 'token-1234',
      },
      pointsPerCheckIn: 25,
    },
    image: { originalname: 'cover.png' },
  });

  assert.equal(result.status, 'inactive');
  assert.equal(result.enabledPackages.length, 0);
  assert.equal(result.imageUrl.includes('cover.png'), true);
  assert.equal(result.openingTime, '08:00');
  assert.equal(result.closingTime, '22:00');
  assert.equal((await menuRepository.getByRestaurantId(result.id)).name, 'Cafe One Menu');
});

test('RestaurantService lists restaurants for active user accounts', async () => {
  const { restaurantService, restaurantRepository } = createServices();
  await restaurantRepository.create({
    id: 'restaurant-1',
    name: 'Cafe One',
    address: '123 Main Street',
    city: 'Dhaka',
    latitude: 23.7,
    longitude: 90.4,
    category: 'Cafe',
    openingTime: '08:00',
    closingTime: '22:00',
    imageUrl: 'https://cdn.example.com/r.png',
    qrCode: { name: 'Cafe QR', location: { latitude: 23.7, longitude: 90.4 }, token: 'token-1' },
    pointsPerCheckIn: 20,
    enabledPackages: ['active'],
    status: 'inactive',
    createdBy: 'admin-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const result = await restaurantService.listRestaurants({ accessToken: 'user-1' });
  assert.equal(result.length, 1);
  assert.equal(result[0].enabledFeatures.find((feature) => feature.key === 'checkInRewards').enabled, true);
});

test('MenuService creates and updates menu items', async () => {
  const { menuService, restaurantRepository } = createServices();
  await restaurantRepository.create({
    id: 'restaurant-1',
    name: 'Cafe One',
    address: '123 Main Street',
    city: 'Dhaka',
    latitude: 23.7,
    longitude: 90.4,
    category: 'Cafe',
    openingTime: '08:00',
    closingTime: '22:00',
    imageUrl: 'https://cdn.example.com/r.png',
    qrCode: { name: 'Cafe QR', location: { latitude: 23.7, longitude: 90.4 }, token: 'token-1' },
    pointsPerCheckIn: 20,
    enabledPackages: [],
    status: 'inactive',
    createdBy: 'admin-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const created = await menuService.createMenuItem({
    accessToken: 'admin-1',
    restaurantId: 'restaurant-1',
    payload: {
      name: 'Latte',
      description: 'Milk coffee',
      price: 12.5,
      pointsToBuy: 100,
      isAvailable: true,
    },
    image: { originalname: 'latte.png' },
  });

  const updated = await menuService.updateMenuItem({
    accessToken: 'admin-1',
    restaurantId: 'restaurant-1',
    itemId: created.id,
    payload: {
      description: 'Iced milk coffee',
      hasImageUrlField: false,
      isAvailable: false,
    },
  });

  assert.equal(created.price, 12.5);
  assert.equal(updated.description, 'Iced milk coffee');
  assert.equal(updated.isAvailable, false);
});

test('RestaurantService builds check-in based analytics for a restaurant', async () => {
  const createdAt = (value) => new Date(value);
  const { restaurantService, restaurantRepository } = createServices({
    checkins: [
      {
        id: 'checkin-1',
        userId: 'user-1',
        userFullname: 'Jane',
        userEmail: 'jane@example.com',
        restaurantId: 'restaurant-1',
        awardedPoints: 20,
        createdAt: createdAt('2026-05-20T08:00:00.000Z'),
      },
      {
        id: 'checkin-2',
        userId: 'user-1',
        userFullname: 'Jane',
        userEmail: 'jane@example.com',
        restaurantId: 'restaurant-1',
        awardedPoints: 20,
        createdAt: createdAt('2026-05-21T18:00:00.000Z'),
      },
      {
        id: 'checkin-3',
        userId: 'user-2',
        userFullname: 'John',
        userEmail: 'john@example.com',
        restaurantId: 'restaurant-1',
        awardedPoints: 10,
        createdAt: createdAt('2026-05-21T19:00:00.000Z'),
      },
    ],
  });
  await restaurantRepository.create({
    id: 'restaurant-1',
    name: 'Cafe Analytics',
    address: '123 Main Street',
    city: 'Dhaka',
    latitude: 23.7,
    longitude: 90.4,
    category: 'Cafe',
    imageUrl: null,
    qrCode: { name: 'Cafe QR', location: { latitude: 23.7, longitude: 90.4 }, token: 'token-1' },
    pointsPerCheckIn: 20,
    enabledPackages: ['prime'],
    status: 'active',
    createdBy: 'admin-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const result = await restaurantService.getRestaurantAnalytics({
    accessToken: 'admin-1',
    restaurantId: 'restaurant-1',
    range: 'last_30_days',
  });

  assert.equal(result.kpis.totalCheckIns, 3);
  assert.equal(result.kpis.uniqueVisitors, 2);
  assert.equal(result.kpis.repeatVisitRate, 50);
  assert.equal(result.loyalty.returningCustomers, 1);
  assert.equal(result.topUsers[0].userId, 'user-1');
  assert.equal(result.visitBreakdown.some((item) => item.checkIns === 2), true);
  assert.equal(result.routeTrafficTracked, false);
});
