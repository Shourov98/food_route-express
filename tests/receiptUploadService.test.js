import assert from 'node:assert/strict';
import test from 'node:test';

import { ReceiptUploadService } from '../src/modules/receiptUploads/receiptUploadService.js';
import { XpService } from '../src/modules/xp/xpService.js';

class FakeUserRepository {
  constructor(users) {
    this.users = new Map(users.map((user) => [user.uid, user]));
  }

  async getByUid(uid) {
    return this.users.get(uid) ?? null;
  }
}

class FakeCheckInRepository {
  constructor(records = []) {
    this.records = records;
  }

  async getById(id) {
    return this.records.find((record) => record.id === id) ?? null;
  }

  async listByUser(userId) {
    return this.records
      .filter((record) => record.userId === userId)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  }
}

class FakeRestaurantRepository {
  constructor(records = []) {
    this.records = new Map(records.map((record) => [record.id, record]));
  }

  async getById(id) {
    return this.records.get(id) ?? null;
  }
}

class FakeReceiptUploadRepository {
  constructor(records = []) {
    this.records = new Map(records.map((record) => [record.id, record]));
  }

  async create(record) {
    this.records.set(record.id, record);
    return record;
  }

  async getByCheckinId(checkinId) {
    return [...this.records.values()].find((record) => record.checkinId === checkinId) ?? null;
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
    return {
      storagePath: `${folder}/${file.originalname}`,
      publicUrl: `https://cdn.example.com/${folder}/${file.originalname}`,
    };
  }
}

class FakeLedgerRepository {
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

function makeCheckin(overrides = {}) {
  return {
    id: 'checkin-1',
    userId: 'user-1',
    restaurantId: 'restaurant-1',
    restaurantName: 'Cafe One',
    restaurantAddress: '123 Main Street',
    awardedXp: 25,
    awardedPoints: 25,
    createdAt: new Date('2026-06-16T08:00:00.000Z'),
    ...overrides,
  };
}

function makeRestaurant(overrides = {}) {
  return {
    id: 'restaurant-1',
    name: 'Cafe One',
    pointsPerCheckIn: 25,
    receiptUploadEnabled: true,
    pointsPerReceiptUpload: 25,
    ...overrides,
  };
}

function createService({
  uploads = [],
  checkins = [makeCheckin()],
  restaurants = [makeRestaurant()],
} = {}) {
  const xpRepository = new FakeLedgerRepository();
  const pointsRepository = new FakeLedgerRepository();
  return {
    xpRepository,
    pointsRepository,
    service: new ReceiptUploadService({
      receiptUploadRepository: new FakeReceiptUploadRepository(uploads),
      checkinRepository: new FakeCheckInRepository(checkins),
      restaurantRepository: new FakeRestaurantRepository(restaurants),
      userRepository: new FakeUserRepository([makeUser()]),
      identityProvider: new FakeIdentityProvider(),
      imageStorage: new FakeImageStorage(),
      xpService: new XpService({ xpRepository, pointsRepository }),
      nowProvider: () => new Date('2026-06-16T09:00:00.000Z'),
    }),
  };
}

test('ReceiptUploadService uploads a receipt and awards restaurant-configured XP and points', async () => {
  const { service, xpRepository, pointsRepository } = createService({
    restaurants: [makeRestaurant({ pointsPerReceiptUpload: 40 })],
  });

  const result = await service.uploadReceipt({
    accessToken: 'user-1',
    restaurantId: 'restaurant-1',
    image: { originalname: 'receipt.png', mimetype: 'image/png', buffer: Buffer.from('x') },
  });

  assert.equal(result.data.restaurantId, 'restaurant-1');
  assert.equal(result.data.awardedXp, 40);
  assert.equal(result.data.awardedPoints, 40);
  assert.equal(result.message, 'Receipt uploaded successfully.');
  assert.equal(xpRepository.records.length, 1);
  assert.equal(pointsRepository.records.length, 1);
  assert.equal(xpRepository.records[0].sourceType, 'receipt_upload');
  assert.equal(pointsRepository.records[0].sourceId, 'checkin-1');
});

test('ReceiptUploadService rejects duplicate receipt rewards for the same check-in', async () => {
  const uploaded = {
    id: 'upload-1',
    checkinId: 'checkin-1',
    userId: 'user-1',
    restaurantId: 'restaurant-1',
    restaurantName: 'Cafe One',
    receiptImageUrl: 'https://cdn.example.com/receipt.png',
    receiptStoragePath: 'receipts/restaurant-1/checkin-1/receipt.png',
    awardedXp: 25,
    awardedPoints: 25,
    createdAt: new Date('2026-06-16T08:30:00.000Z'),
  };
  const { service, xpRepository, pointsRepository } = createService({ uploads: [uploaded] });

  await assert.rejects(
    service.uploadReceipt({
      accessToken: 'user-1',
      restaurantId: 'restaurant-1',
      image: { originalname: 'receipt.png', mimetype: 'image/png', buffer: Buffer.from('x') },
    }),
    (error) => error.code === 'eligible_checkin_not_found',
  );
  assert.equal(xpRepository.records.length, 0);
  assert.equal(pointsRepository.records.length, 0);
});

test('ReceiptUploadService uses the latest unclaimed check-in for the restaurant', async () => {
  const { service, pointsRepository } = createService({
    checkins: [
      makeCheckin({ id: 'checkin-2', createdAt: new Date('2026-06-16T10:00:00.000Z') }),
      makeCheckin({ id: 'checkin-1', createdAt: new Date('2026-06-16T08:00:00.000Z') }),
    ],
    uploads: [
      {
        id: 'upload-1',
        checkinId: 'checkin-2',
        userId: 'user-1',
        restaurantId: 'restaurant-1',
        restaurantName: 'Cafe One',
        receiptImageUrl: 'https://cdn.example.com/receipt.png',
        receiptStoragePath: 'receipts/restaurant-1/checkin-2/receipt.png',
        awardedXp: 25,
        awardedPoints: 25,
        createdAt: new Date('2026-06-16T10:30:00.000Z'),
      },
    ],
  });

  const result = await service.uploadReceipt({
    accessToken: 'user-1',
    restaurantId: 'restaurant-1',
    image: { originalname: 'receipt.png', mimetype: 'image/png', buffer: Buffer.from('x') },
  });

  assert.equal(result.data.checkinId, 'checkin-1');
  assert.equal(pointsRepository.records[0].sourceId, 'checkin-1');
});
