import assert from 'node:assert/strict';
import test from 'node:test';

import { CheckInService } from '../src/modules/checkins/checkinService.js';
import { QrCodeService } from '../src/modules/qrCodes/qrCodeService.js';
import { XpService } from '../src/modules/xp/xpService.js';

class FakeUserRepository {
  constructor(users) {
    this.users = new Map(users.map((user) => [user.uid, user]));
  }

  async getByUid(uid) {
    return this.users.get(uid) ?? null;
  }
}

class FakeRestaurantRepository {
  constructor(records) {
    this.records = new Map(records.map((record) => [record.id, record]));
  }

  async getById(id) {
    return this.records.get(id) ?? null;
  }

  async getByQrToken(token) {
    return [...this.records.values()].find((record) => record.qrCode.token === token) ?? null;
  }

  async listAll() {
    return [...this.records.values()];
  }
}

class FakeCheckInRepository {
  constructor(records = []) {
    this.records = records;
  }

  async create(record) {
    this.records.push(record);
    return record;
  }

  async getRecentByUser(userId) {
    return this.records
      .filter((record) => record.userId === userId)
      .sort((left, right) => right.createdAt - left.createdAt)[0] ?? null;
  }

  async getRecentByUserAndRestaurant({ userId, restaurantId }) {
    return this.records
      .filter((record) => record.userId === userId && record.restaurantId === restaurantId)
      .sort((left, right) => right.createdAt - left.createdAt)[0] ?? null;
  }

  async listAll() {
    return [...this.records];
  }

  async listByUser(userId) {
    return this.records.filter((record) => record.userId === userId);
  }

  async countByUser(userId) {
    return this.records.filter((record) => record.userId === userId).length;
  }
}

class FakeIdentityProvider {
  async verifyIdToken(token) {
    return { uid: token };
  }
}

class FakeXpRepository {
  constructor() {
    this.records = [];
  }

  async create(record) {
    this.records.push(record);
    return record;
  }

  async delete(recordId) {
    const index = this.records.findIndex((record) => record.id === recordId);
    if (index === -1) {
      return false;
    }
    this.records.splice(index, 1);
    return true;
  }

  async listByUser(userId) {
    return this.records.filter((record) => record.userId === userId);
  }

  async getBySource({ userId, sourceType, sourceId }) {
    return (
      this.records.find(
        (record) =>
          record.userId === userId &&
          record.sourceType === sourceType &&
          record.sourceId === sourceId,
      ) ?? null
    );
  }
}

class FakePointsRepository extends FakeXpRepository {}

function makeRestaurant(overrides = {}) {
  return {
    id: 'restaurant-1',
    name: 'Cafe One',
    address: '123 Main Street',
    category: 'Cafe',
    pointsPerCheckIn: 25,
    status: 'active',
    qrCode: {
      name: 'Cafe QR',
      token: 'token-1234',
      location: { latitude: 23.7, longitude: 90.4 },
    },
    ...overrides,
  };
}

function makeRestaurantTwo(overrides = {}) {
  return makeRestaurant({
    id: 'restaurant-2',
    name: 'Bistro Two',
    address: '456 Side Street',
    qrCode: {
      name: 'Bistro QR',
      token: 'token-5678',
      location: { latitude: 23.8, longitude: 90.5 },
    },
    ...overrides,
  });
}

function makeUser(overrides = {}) {
  return {
    uid: 'user-1',
    fullname: 'Jane Doe',
    email: 'user@example.com',
    city: 'Dhaka',
    country: 'Bangladesh',
    role: 'user',
    isBlocked: false,
    isVerified: true,
    ...overrides,
  };
}

function createService({
  checkins = [],
  restaurants = [makeRestaurant()],
  now = new Date('2026-05-24T06:00:00.000Z'),
  xpRepository = new FakeXpRepository(),
  pointsRepository = new FakePointsRepository(),
} = {}) {
  return {
    xpRepository,
    pointsRepository,
    repository: new FakeCheckInRepository(checkins),
    service: new CheckInService({
      checkinRepository: new FakeCheckInRepository(checkins),
      restaurantRepository: new FakeRestaurantRepository(restaurants),
      userRepository: new FakeUserRepository([makeUser()]),
      identityProvider: new FakeIdentityProvider(),
      xpService: new XpService({
        xpRepository,
        pointsRepository,
      }),
      nowProvider: () => now,
    }),
  };
}

test('CheckInService scans QR and awards XP/points', async () => {
  const { service } = createService();

  const result = await service.scanQr({
    accessToken: 'user-1',
    qrToken: JSON.stringify({
      type: 'restaurant_check_in',
      token: 'token-1234',
      restaurantName: 'Cafe One',
      latitude: 23.7,
      longitude: 90.4,
    }),
    latitude: 23.7002,
    longitude: 90.4002,
  });

  assert.equal(result.data.restaurantId, 'restaurant-1');
  assert.equal(result.data.awardedXp, 25);
  assert.equal(result.message, 'Check-in completed successfully.');
});

test('CheckInService rejects a duplicate same-day check-in in the same meal window at the same restaurant', async () => {
  const now = new Date('2026-05-24T06:00:00.000Z');
  const existingCheckin = {
    id: 'check-1',
    userId: 'user-1',
    userFullname: 'Jane Doe',
    userEmail: 'user@example.com',
    restaurantId: 'restaurant-1',
    restaurantName: 'Cafe One',
    restaurantAddress: '123 Main Street',
    qrToken: 'token-1234',
    awardedXp: 25,
    awardedPoints: 25,
    createdAt: new Date('2026-05-24T05:30:00.000Z'),
  };
  const { service, xpRepository, pointsRepository } = createService({
    checkins: [existingCheckin],
    now,
  });

  await assert.rejects(
    service.scanQr({
      accessToken: 'user-1',
      qrToken: 'token-1234',
      latitude: 23.7002,
      longitude: 90.4002,
    }),
    (error) => error.code === 'checkin_meal_window_limit_reached',
  );
  assert.equal(xpRepository.records.length, 0);
  assert.equal(pointsRepository.records.length, 0);
});

test('CheckInService allows a same-day check-in at the same restaurant in a different meal window', async () => {
  const existingCheckin = {
    id: 'check-1',
    userId: 'user-1',
    userFullname: 'Jane Doe',
    userEmail: 'user@example.com',
    restaurantId: 'restaurant-1',
    restaurantName: 'Cafe One',
    restaurantAddress: '123 Main Street',
    qrToken: 'token-1234',
    awardedXp: 25,
    awardedPoints: 25,
    createdAt: new Date('2026-05-24T05:30:00.000Z'),
  };
  const checkins = [existingCheckin];
  const xpRepository = new FakeXpRepository();
  const pointsRepository = new FakePointsRepository();
  const repository = new FakeCheckInRepository(checkins);
  const service = new CheckInService({
    checkinRepository: repository,
    restaurantRepository: new FakeRestaurantRepository([makeRestaurant()]),
    userRepository: new FakeUserRepository([makeUser()]),
    identityProvider: new FakeIdentityProvider(),
    xpService: new XpService({
      xpRepository,
      pointsRepository,
    }),
    nowProvider: () => new Date('2026-05-24T12:00:00.000Z'),
  });

  const result = await service.scanQr({
    accessToken: 'user-1',
    qrToken: 'token-1234',
    latitude: 23.7002,
    longitude: 90.4002,
  });

  assert.equal(result.message, 'Check-in completed successfully.');
  assert.equal(repository.records.length, 2);
  assert.equal(xpRepository.records.length, 1);
  assert.equal(pointsRepository.records.length, 1);
});

test('CheckInService allows same-day check-ins across different restaurants in the same meal window', async () => {
  const xpRepository = new FakeXpRepository();
  const pointsRepository = new FakePointsRepository();
  const repository = new FakeCheckInRepository();
  const service = new CheckInService({
    checkinRepository: repository,
    restaurantRepository: new FakeRestaurantRepository([makeRestaurant(), makeRestaurantTwo()]),
    userRepository: new FakeUserRepository([makeUser()]),
    identityProvider: new FakeIdentityProvider(),
    xpService: new XpService({
      xpRepository,
      pointsRepository,
    }),
    nowProvider: () => new Date('2026-05-24T12:00:00.000Z'),
  });

  const first = await service.scanQr({
    accessToken: 'user-1',
    qrToken: 'token-1234',
    latitude: 23.7002,
    longitude: 90.4002,
  });
  const second = await service.scanQr({
    accessToken: 'user-1',
    qrToken: 'token-5678',
    latitude: 23.8002,
    longitude: 90.5002,
  });

  assert.equal(first.data.restaurantId, 'restaurant-1');
  assert.equal(second.data.restaurantId, 'restaurant-2');
  assert.equal(repository.records.length, 2);
  assert.equal(xpRepository.records.length, 2);
  assert.equal(pointsRepository.records.length, 2);
});

test('CheckInService rejects scans outside breakfast, lunch, and dinner windows', async () => {
  const { service } = createService({
    now: new Date('2026-05-24T23:30:00.000Z'),
  });

  await assert.rejects(
    service.scanQr({
      accessToken: 'user-1',
      qrToken: 'token-1234',
      latitude: 23.7002,
      longitude: 90.4002,
    }),
    (error) => error.code === 'checkin_outside_meal_window',
  );
});

test('CheckInService rejects scans when the user is too far from the restaurant QR location', async () => {
  const service = new CheckInService({
    checkinRepository: new FakeCheckInRepository(),
    restaurantRepository: new FakeRestaurantRepository([makeRestaurant()]),
    userRepository: new FakeUserRepository([makeUser()]),
    identityProvider: new FakeIdentityProvider(),
    xpService: new XpService({
      xpRepository: new FakeXpRepository(),
      pointsRepository: new FakePointsRepository(),
    }),
  });

  await assert.rejects(
    service.scanQr({
      accessToken: 'user-1',
      qrToken: 'token-1234',
      latitude: 23.75,
      longitude: 90.45,
    }),
    (error) =>
      error.code === 'checkin_out_of_range' &&
      error.message ===
        'You are too far from this restaurant to check in. Make sure you are at the restaurant and scanning its QR code.',
  );
});

test('CheckInService returns a clear error when the QR payload does not match the restaurant', async () => {
  const { service } = createService();

  await assert.rejects(
    service.scanQr({
      accessToken: 'user-1',
      qrToken: JSON.stringify({
        type: 'restaurant_check_in',
        token: 'token-1234',
        restaurantName: 'Wrong Name',
        latitude: 23.7,
        longitude: 90.4,
      }),
      latitude: 23.7002,
      longitude: 90.4002,
    }),
    (error) =>
      error.code === 'restaurant_qr_mismatch' &&
      error.message ===
        'This QR code does not match this restaurant. Please scan the QR code displayed at the restaurant you are visiting.',
  );
});

test('CheckInService returns a clear error when the QR code is not recognized', async () => {
  const { service } = createService();

  await assert.rejects(
    service.scanQr({
      accessToken: 'user-1',
      qrToken: 'unknown-token',
      latitude: 23.7002,
      longitude: 90.4002,
    }),
    (error) =>
      error.code === 'restaurant_qr_not_found' &&
      error.message ===
        'This QR code is not recognized. Please scan the restaurant check-in QR code again.',
  );
});

test('QrCodeService returns QR details for admin', async () => {
  const service = new QrCodeService({
    restaurantRepository: new FakeRestaurantRepository([makeRestaurant({ currentPackage: 'prime' })]),
    userRepository: new FakeUserRepository([{ uid: 'admin-1', role: 'admin', isBlocked: false }]),
    identityProvider: new FakeIdentityProvider(),
  });

  const result = await service.getQrDetails({
    accessToken: 'admin-1',
    restaurantId: 'restaurant-1',
  });

  assert.equal(result.restaurantId, 'restaurant-1');
  assert.equal(result.qrCodeToken, 'token-1234');
});
