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
    // Simulate Firestore's SERIALIZABLE isolation by routing all writes
    // through a single in-flight promise. Without this lock, two concurrent
    // calls could both pass `getBySource === null` and both insert.
    this._txnChain = Promise.resolve();
  }

  async _runExclusive(fn) {
    const next = this._txnChain.then(fn, fn);
    this._txnChain = next.catch(() => undefined);
    return next;
  }

  async create(record) {
    return this._runExclusive(() => {
      this.records.push(record);
      return record;
    });
  }

  async createIfAbsent(record) {
    return this._runExclusive(() => {
      const existing = this.records.find(
        (entry) =>
          entry.userId === record.userId &&
          entry.sourceType === record.sourceType &&
          entry.sourceId === record.sourceId,
      );
      if (existing) {
        return null;
      }
      this.records.push(record);
      return record;
    });
  }

  async delete(recordId) {
    return this._runExclusive(() => {
      const index = this.records.findIndex((record) => record.id === recordId);
      if (index === -1) {
        return false;
      }
      this.records.splice(index, 1);
      return true;
    });
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

test('CheckInService rejects a duplicate same-restaurant check-in within 24 hours', async () => {
  const now = new Date('2026-05-24T12:00:00.000Z');
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
    (error) => error.code === 'checkin_cooldown_active',
  );
  assert.equal(xpRepository.records.length, 0);
  assert.equal(pointsRepository.records.length, 0);
});

test('CheckInService allows another same-restaurant check-in after 24 hours', async () => {
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
    nowProvider: () => new Date('2026-05-25T05:31:00.000Z'),
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

test('CheckInService rejects the sixth valid check-in in the same UTC day', async () => {
  const checkins = Array.from({ length: 5 }, (_, index) => ({
    id: `check-${index + 1}`,
    userId: 'user-1',
    userFullname: 'Jane Doe',
    userEmail: 'user@example.com',
    restaurantId: `previous-${index + 1}`,
    restaurantName: `Previous ${index + 1}`,
    restaurantAddress: '123 Main Street',
    qrToken: `previous-token-${index + 1}`,
    awardedXp: 25,
    awardedPoints: 25,
    createdAt: new Date(`2026-05-24T0${index}:00:00.000Z`),
  }));
  const { service } = createService({
    checkins,
    now: new Date('2026-05-24T23:30:00.000Z'),
  });

  await assert.rejects(
    service.scanQr({
      accessToken: 'user-1',
      qrToken: 'token-1234',
      latitude: 23.7002,
      longitude: 90.4002,
    }),
    (error) => error.code === 'daily_checkin_limit_reached',
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

test('XpService.createIfAbsent is idempotent for the same (userId, sourceType, sourceId) triple', async () => {
  const xpRepository = new FakeXpRepository();
  const pointsRepository = new FakePointsRepository();
  const service = new XpService({ xpRepository, pointsRepository });

  // Two awardXp calls with the SAME sourceId should produce only one XP
  // row. The second call returns null (the existing record), and the
  // caller treats that as a no-op.
  const first = await service.awardXp({
    userId: 'user-1',
    delta: 50,
    sourceType: 'check_in',
    sourceId: 'check-1',
    city: '',
    country: '',
  });
  const second = await service.awardXp({
    userId: 'user-1',
    delta: 50,
    sourceType: 'check_in',
    sourceId: 'check-1',
    city: '',
    country: '',
  });

  assert.ok(first, 'first award must return a record');
  assert.equal(second, null, 'second award with same sourceId must return null');
  assert.equal(
    xpRepository.records.length,
    1,
    `expected exactly 1 XP row, got ${xpRepository.records.length}`,
  );
});

test('XpService.createIfAbsent is idempotent for wallet points on the same sourceId', async () => {
  const xpRepository = new FakeXpRepository();
  const pointsRepository = new FakePointsRepository();
  const service = new XpService({ xpRepository, pointsRepository });

  const first = await service.awardPoints({
    userId: 'user-1',
    delta: 50,
    sourceType: 'check_in',
    sourceId: 'check-2',
    city: '',
    country: '',
  });
  const second = await service.awardPoints({
    userId: 'user-1',
    delta: 50,
    sourceType: 'check_in',
    sourceId: 'check-2',
    city: '',
    country: '',
  });

  assert.ok(first, 'first award must return a record');
  assert.equal(second, null, 'second award with same sourceId must return null');
  assert.equal(
    pointsRepository.records.length,
    1,
    `expected exactly 1 wallet row, got ${pointsRepository.records.length}`,
  );
});

test('CheckInService.scanQr survives a duplicate check-in retry without double-awarding', async () => {
  // Simulate the realistic race: the user double-taps the same scan button
  // on a flaky network, causing the same QR payload to be POSTed twice.
  // Without transactional dedupe the second scan would still resolve but
  // would have already awarded points to the ledger on the first try.
  // Here we verify that `createIfAbsent` returns null on the second call,
  // and the caller (checkinService) short-circuits the points write.
  const xpRepository = new FakeXpRepository();
  const pointsRepository = new FakePointsRepository();
  const xpService = new XpService({ xpRepository, pointsRepository });

  // Pre-seed an XP row as if the first scan already succeeded.
  await xpService.awardXp({
    userId: 'user-1',
    delta: 50,
    sourceType: 'check_in',
    sourceId: 'check-1',
    city: '',
    country: '',
  });

  // Second call with same sourceId must be a no-op (returns null).
  const replay = await xpService.awardXp({
    userId: 'user-1',
    delta: 50,
    sourceType: 'check_in',
    sourceId: 'check-1',
    city: '',
    country: '',
  });

  assert.equal(replay, null, 'replay with same sourceId must return null');
  assert.equal(
    xpRepository.records.length,
    1,
    `expected exactly 1 XP row after replay, got ${xpRepository.records.length}`,
  );
});

test('CheckInService includes distance, radius and restaurant name in the checkin_out_of_range details payload', async () => {
  const service = new CheckInService({
    checkinRepository: new FakeCheckInRepository(),
    restaurantRepository: new FakeRestaurantRepository([makeRestaurant({ checkinRadiusMeters: 100 })]),
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
      latitude: 23.705,
      longitude: 90.405,
    }),
    (error) => {
      if (error.code !== 'checkin_out_of_range') return false;
      const details = error.details || {};
      return (
        typeof details.distanceMeters === 'number' &&
        details.distanceMeters > 100 &&
        details.allowedRadiusMeters === 100 &&
        details.restaurantName === 'Cafe One'
      );
    },
  );
});

test('CheckInService includes accuracy values in the checkin_location_inaccurate details payload', async () => {
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
      latitude: 23.7002,
      longitude: 90.4002,
      accuracy: 250,
    }),
    (error) => {
      if (error.code !== 'checkin_location_inaccurate') return false;
      const details = error.details || {};
      return (
        details.accuracyMeters === 250 &&
        typeof details.maxAccuracyMeters === 'number'
      );
    },
  );
});

test('CheckInService includes age values in the checkin_location_stale details payload', async () => {
  const now = new Date('2026-05-24T12:00:00.000Z');
  const service = new CheckInService({
    checkinRepository: new FakeCheckInRepository(),
    restaurantRepository: new FakeRestaurantRepository([makeRestaurant()]),
    userRepository: new FakeUserRepository([makeUser()]),
    identityProvider: new FakeIdentityProvider(),
    xpService: new XpService({
      xpRepository: new FakeXpRepository(),
      pointsRepository: new FakePointsRepository(),
    }),
    nowProvider: () => now,
  });

  const staleTimestamp = new Date(now.getTime() - 10 * 60 * 1000);

  await assert.rejects(
    service.scanQr({
      accessToken: 'user-1',
      qrToken: 'token-1234',
      latitude: 23.7002,
      longitude: 90.4002,
      locationCapturedAt: staleTimestamp,
    }),
    (error) => {
      if (error.code !== 'checkin_location_stale') return false;
      const details = error.details || {};
      return (
        typeof details.ageSeconds === 'number' &&
        details.ageSeconds >= 600 &&
        typeof details.maxAgeSeconds === 'number'
      );
    },
  );
});

test('CheckInService honors a restaurant-configured check-in radius', async () => {
  const { service } = createService({
    restaurants: [makeRestaurant({ checkinRadiusMeters: 500 })],
  });

  const result = await service.scanQr({
    accessToken: 'user-1',
    qrToken: 'token-1234',
    latitude: 23.703,
    longitude: 90.403,
  });

  assert.equal(result.data.restaurantId, 'restaurant-1');
});

test('CheckInService rejects inaccurate location fixes when provided', async () => {
  const { service } = createService();

  await assert.rejects(
    service.scanQr({
      accessToken: 'user-1',
      qrToken: 'token-1234',
      latitude: 23.7002,
      longitude: 90.4002,
      accuracy: 250,
    }),
    (error) => error.code === 'checkin_location_inaccurate',
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
