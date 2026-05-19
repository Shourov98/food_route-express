import assert from 'node:assert/strict';
import test from 'node:test';

import { LevelService } from '../src/modules/levels/levelService.js';
import { PackageService } from '../src/modules/packages/packageService.js';
import { UserService } from '../src/modules/users/userService.js';
import { XpService } from '../src/modules/xp/xpService.js';

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
  async listByRole(role) {
    return [...this.users.values()].filter((user) => user.role === role);
  }
}

class FakeRestaurantRepository {
  constructor(records = []) {
    this.records = new Map(records.map((record) => [record.id, record]));
  }
  async getById(id) {
    return this.records.get(id) ?? null;
  }
  async update(id, record) {
    this.records.set(id, record);
    return record;
  }
  async listAll() {
    return [...this.records.values()];
  }
}

class FakeLevelRepository {
  constructor(records = []) {
    this.records = new Map(records.map((record) => [record.id, record]));
  }
  async create(record) {
    this.records.set(record.id, record);
    return record;
  }
  async listAll() {
    return [...this.records.values()].sort((a, b) => a.minXp - b.minXp);
  }
  async getById(id) {
    return this.records.get(id) ?? null;
  }
  async update(id, record) {
    this.records.set(id, record);
    return record;
  }
  async delete(id) {
    return this.records.delete(id);
  }
}

class FakeProximityAlertRepository {
  constructor(records = []) {
    this.records = new Map(records.map((record) => [record.id, record]));
  }
  async create(record) {
    this.records.set(record.id, record);
    return record;
  }
  async getByUserAndRestaurant({ userId, restaurantId }) {
    return this.records.get(`${userId}:${restaurantId}`) ?? null;
  }
}

class FakeLoginEventRepository {
  async listByUser() {
    return [];
  }
  async countCurrentStreak() {
    return 0;
  }
}

class FakeCheckInRepository {
  async countByUser() {
    return 0;
  }
}

class FakeImageStorage {}
class FakePushNotificationService {
  constructor() {
    this.messages = [];
  }
  async send(message) {
    this.messages.push(message);
    return message;
  }
}

class FakeXpRepository {
  async listByUser() {
    return [];
  }
}

class FakePointsRepository {
  constructor(records = []) {
    this.records = records;
  }
  async listByUser(userId) {
    return this.records.filter((record) => record.userId === userId);
  }
  async create(record) {
    this.records.push(record);
    return record;
  }
  async getBySource() {
    return null;
  }
}

function makeUser(overrides = {}) {
  return {
    uid: 'user-1',
    fullname: 'Jane Doe',
    email: 'jane@example.com',
    gender: 'female',
    age: 28,
    city: 'Dhaka',
    country: 'Bangladesh',
    profileImageUrl: null,
    referralCode: 'ABCDEFGH',
    role: 'user',
    isVerified: true,
    isBlocked: false,
    proximityAlertsEnabled: true,
    proximityDistanceKm: 2,
    lastKnownLatitude: 23.75,
    lastKnownLongitude: 90.39,
    ...overrides,
  };
}

test('PackageService activates and upgrades restaurant packages', async () => {
  const service = new PackageService({
    restaurantRepository: new FakeRestaurantRepository([
      {
        id: 'rest-1',
        name: 'Cafe',
        address: 'Road 1',
        city: 'Dhaka',
        latitude: 23.75,
        longitude: 90.39,
        category: 'cafe',
        imageUrl: null,
        qrCode: { token: 'tok', name: 'Cafe', location: { latitude: 23.75, longitude: 90.39 } },
        pointsPerCheckIn: 10,
        status: 'inactive',
        createdBy: 'admin-1',
        enabledPackages: [],
        currentPackage: null,
        billingCycle: null,
        activatedAt: null,
        expiresAt: null,
      },
    ]),
    userRepository: new FakeUserRepository([{ uid: 'admin-1', role: 'admin', isBlocked: false }]),
    identityProvider: new FakeIdentityProvider(),
  });

  const activated = await service.activatePackage({
    accessToken: 'admin-1',
    restaurantId: 'rest-1',
    payload: { package: 'start' },
  });
  assert.equal(activated.packageState.currentPackage, 'start');

  const upgraded = await service.upgradePackage({
    accessToken: 'admin-1',
    restaurantId: 'rest-1',
    payload: { package: 'pro' },
  });
  assert.equal(upgraded.packageState.currentPackage, 'pro');
});

test('LevelService seeds defaults and enforces unique minXp', async () => {
  const service = new LevelService({
    levelRepository: new FakeLevelRepository(),
    userRepository: new FakeUserRepository([{ uid: 'admin-1', role: 'admin', isBlocked: false }]),
    identityProvider: new FakeIdentityProvider(),
  });

  const listed = await service.listLevels({ accessToken: 'admin-1' });
  assert.equal(listed.items.length > 1, true);

  await assert.rejects(
    service.createLevel({
      accessToken: 'admin-1',
      payload: { name: 'Duplicate', minXp: listed.items[0].minXp },
    }),
    (error) => error.code === 'level_min_xp_conflict',
  );
});

test('UserService scanAllProximityAlerts creates alerts for nearby active restaurants', async () => {
  const pointsRepository = new FakePointsRepository([]);
  const pushNotificationService = new FakePushNotificationService();
  const service = new UserService({
    userRepository: new FakeUserRepository([
      makeUser({ pushNotificationToken: 'push-1' }),
      makeUser({ uid: 'user-2', email: 'two@example.com', proximityAlertsEnabled: false }),
    ]),
    loginEventRepository: new FakeLoginEventRepository(),
    identityProvider: new FakeIdentityProvider(),
    xpService: new XpService({
      xpRepository: new FakeXpRepository(),
      pointsRepository,
    }),
    leaderboardService: { getMyRanks: async () => ({}) },
    checkinRepository: new FakeCheckInRepository(),
    imageStorage: new FakeImageStorage(),
    restaurantRepository: new FakeRestaurantRepository([
      {
        id: 'rest-1',
        name: 'Cafe',
        address: 'Road 1',
        city: 'Dhaka',
        latitude: 23.751,
        longitude: 90.391,
        category: 'cafe',
        status: 'active',
      },
      {
        id: 'rest-2',
        name: 'Far',
        address: 'Road 9',
        city: 'Dhaka',
        latitude: 24.5,
        longitude: 91.0,
        category: 'cafe',
        status: 'active',
      },
    ]),
    proximityAlertRepository: new FakeProximityAlertRepository(),
    pushNotificationService,
  });

  const result = await service.scanAllProximityAlerts();
  assert.equal(result.processedUsers, 2);
  assert.equal(result.createdAlerts, 1);
  assert.equal(result.pushedAlerts, 1);
  assert.equal(pushNotificationService.messages.length, 1);
});
