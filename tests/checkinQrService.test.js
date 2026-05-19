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

test('CheckInService scans QR and awards XP/points', async () => {
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

  const result = await service.scanQr({
    accessToken: 'user-1',
    qrToken: JSON.stringify({
      type: 'restaurant_check_in',
      token: 'token-1234',
      restaurantName: 'Cafe One',
      latitude: 23.7,
      longitude: 90.4,
    }),
  });

  assert.equal(result.data.restaurantId, 'restaurant-1');
  assert.equal(result.data.awardedXp, 25);
  assert.equal(result.message, 'Check-in completed successfully.');
});

test('CheckInService returns same-day same-restaurant success without duplicate award', async () => {
  const repository = new FakeCheckInRepository([
    {
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
      createdAt: new Date(),
    },
  ]);

  const service = new CheckInService({
    checkinRepository: repository,
    restaurantRepository: new FakeRestaurantRepository([makeRestaurant()]),
    userRepository: new FakeUserRepository([makeUser()]),
    identityProvider: new FakeIdentityProvider(),
    xpService: new XpService({
      xpRepository: new FakeXpRepository(),
      pointsRepository: new FakePointsRepository(),
    }),
  });

  const result = await service.scanQr({ accessToken: 'user-1', qrToken: 'token-1234' });
  assert.equal(result.message, 'Checkin awarded with points already.');
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
