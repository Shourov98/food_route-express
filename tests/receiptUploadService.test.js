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

class FakeRouteRepository {
  constructor(records = []) {
    this.records = records;
  }

  async listAll() {
    return [...this.records];
  }
}

class FakeRouteProgressRepository {
  constructor(records = []) {
    this.records = records;
  }

  async create(record) {
    this.records.push(record);
    return record;
  }

  async update(progressId, record) {
    const index = this.records.findIndex((item) => item.id === progressId);
    if (index === -1) return null;
    this.records[index] = record;
    return record;
  }

  async listByUser(userId) {
    return this.records
      .filter((record) => record.userId === userId)
      .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
  }

  async listByUserAndRoute({ userId, routeId }) {
    return (await this.listByUser(userId)).filter((record) => record.routeId === routeId);
  }

  async getLatestByUserAndRoute({ userId, routeId }) {
    return (await this.listByUserAndRoute({ userId, routeId }))[0] ?? null;
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

  async createIfAbsent(record) {
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
  routes = [],
  routeProgress = [],
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
      routeRepository: new FakeRouteRepository(routes),
      routeProgressRepository: new FakeRouteProgressRepository(routeProgress),
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

test('ReceiptUploadService updates route progress and awards completion bonus', async () => {
  const routeProgress = [
    {
      id: 'progress-1',
      routeId: 'route-1',
      userId: 'user-1',
      status: 'in_progress',
      visitedRestaurantIds: ['restaurant-2'],
      receiptUploadIds: ['upload-previous'],
      completedAt: null,
      lastReceiptUploadedAt: new Date('2026-06-16T07:00:00.000Z'),
      createdAt: new Date('2026-06-16T07:00:00.000Z'),
      updatedAt: new Date('2026-06-16T07:00:00.000Z'),
    },
  ];
  const { service, xpRepository, pointsRepository } = createService({
    routes: [
      {
        id: 'route-1',
        routeName: 'Lunch Route',
        city: 'Dhaka',
        restaurantIds: ['restaurant-2', 'restaurant-1'],
        status: 'active',
        requiredVisits: 2,
        mandatoryOrder: false,
        pointsPerReceiptUpload: 10,
        completionBonus: 100,
        repeatable: false,
        cooldownMinutes: 60,
        createdAt: new Date('2026-06-16T00:00:00.000Z'),
        updatedAt: new Date('2026-06-16T00:00:00.000Z'),
      },
    ],
    routeProgress,
  });

  const result = await service.uploadReceipt({
    accessToken: 'user-1',
    restaurantId: 'restaurant-1',
    image: { originalname: 'receipt.png', mimetype: 'image/png', buffer: Buffer.from('x') },
  });

  assert.equal(result.data.routeProgress.length, 1);
  assert.equal(result.data.routeProgress[0].status, 'completed');
  assert.equal(routeProgress[0].status, 'completed');
  assert.deepEqual(routeProgress[0].visitedRestaurantIds, ['restaurant-2', 'restaurant-1']);
  assert.ok(xpRepository.records.some((record) => record.sourceType === 'route_receipt_upload'));
  assert.ok(xpRepository.records.some((record) => record.sourceType === 'route_completion'));
  assert.ok(pointsRepository.records.some((record) => record.sourceType === 'route_completion'));
});

test('ReceiptUploadService rejects route receipt uploads during route cooldown', async () => {
  const { service } = createService({
    routes: [
      {
        id: 'route-1',
        routeName: 'Lunch Route',
        city: 'Dhaka',
        restaurantIds: ['restaurant-1', 'restaurant-2'],
        status: 'active',
        requiredVisits: 2,
        mandatoryOrder: false,
        pointsPerReceiptUpload: 10,
        completionBonus: 100,
        repeatable: false,
        cooldownMinutes: 60,
        createdAt: new Date('2026-06-16T00:00:00.000Z'),
        updatedAt: new Date('2026-06-16T00:00:00.000Z'),
      },
    ],
    routeProgress: [
      {
        id: 'progress-1',
        routeId: 'route-1',
        userId: 'user-1',
        status: 'in_progress',
        visitedRestaurantIds: ['restaurant-2'],
        receiptUploadIds: ['upload-previous'],
        completedAt: null,
        lastReceiptUploadedAt: new Date('2026-06-16T08:30:00.000Z'),
        createdAt: new Date('2026-06-16T08:30:00.000Z'),
        updatedAt: new Date('2026-06-16T08:30:00.000Z'),
      },
    ],
  });

  await assert.rejects(
    service.uploadReceipt({
      accessToken: 'user-1',
      restaurantId: 'restaurant-1',
      image: { originalname: 'receipt.png', mimetype: 'image/png', buffer: Buffer.from('x') },
    }),
    (error) => error.code === 'route_receipt_cooldown_active',
  );
});

// ---------------------------------------------------------------------------
// BR-017 / BR-018 — additional route progress edge cases
// ---------------------------------------------------------------------------

test('BR-017 same restaurant counts only once per route', async () => {
  const { service, xpRepository } = createService({
    routes: [
      {
        id: 'route-1',
        routeName: 'Lunch Route',
        city: 'Dhaka',
        restaurantIds: ['restaurant-1', 'restaurant-2'],
        status: 'active',
        requiredVisits: 2,
        mandatoryOrder: false,
        pointsPerReceiptUpload: 10,
        completionBonus: 0,
        repeatable: false,
        cooldownMinutes: 60,
        createdAt: new Date('2026-06-16T00:00:00.000Z'),
        updatedAt: new Date('2026-06-16T00:00:00.000Z'),
      },
    ],
    routeProgress: [
      {
        id: 'progress-1',
        routeId: 'route-1',
        userId: 'user-1',
        status: 'in_progress',
        visitedRestaurantIds: ['restaurant-1'], // already counted
        receiptUploadIds: ['upload-previous'],
        completedAt: null,
        lastReceiptUploadedAt: new Date('2026-05-16T09:00:00.000Z'), // > 60 min ago
        createdAt: new Date('2026-05-16T09:00:00.000Z'),
        updatedAt: new Date('2026-05-16T09:00:00.000Z'),
      },
    ],
  });

  const result = await service.uploadReceipt({
    accessToken: 'user-1',
    restaurantId: 'restaurant-1', // same restaurant again
    image: { originalname: 'receipt.png', mimetype: 'image/png', buffer: Buffer.from('x') },
  });

  // The route response should report that the restaurant is already counted.
  const routeProgress = result.data.routeProgress[0];
  assert.equal(routeProgress.reason, 'restaurant_already_counted');
  assert.deepEqual(routeProgress.visitedRestaurantIds, ['restaurant-1']);
  // No route_receipt_upload award should fire for the duplicate visit.
  const routeReceiptAwards = xpRepository.records.filter(
    (record) => record.sourceType === 'route_receipt_upload',
  );
  assert.equal(routeReceiptAwards.length, 0);
});

test('BR-017 mandatory order rejects out-of-order restaurant uploads', async () => {
  const { service } = createService({
    restaurants: [
      makeRestaurant(),
      makeRestaurant({ id: 'restaurant-2', name: 'Cafe Two' }),
      makeRestaurant({ id: 'restaurant-3', name: 'Cafe Three' }),
    ],
    checkins: [
      makeCheckin({ restaurantId: 'restaurant-3', restaurantName: 'Cafe Three' }),
    ],
    routes: [
      {
        id: 'route-1',
        routeName: 'Taquera Route',
        city: 'Dhaka',
        restaurantIds: ['restaurant-1', 'restaurant-2', 'restaurant-3'],
        status: 'active',
        requiredVisits: 3,
        mandatoryOrder: true,
        pointsPerReceiptUpload: 10,
        completionBonus: 0,
        repeatable: false,
        cooldownMinutes: 60,
        createdAt: new Date('2026-06-16T00:00:00.000Z'),
        updatedAt: new Date('2026-06-16T00:00:00.000Z'),
      },
    ],
    routeProgress: [
      {
        id: 'progress-1',
        routeId: 'route-1',
        userId: 'user-1',
        status: 'in_progress',
        visitedRestaurantIds: ['restaurant-1'],
        receiptUploadIds: ['upload-previous'],
        completedAt: null,
        lastReceiptUploadedAt: new Date('2026-05-16T09:00:00.000Z'),
        createdAt: new Date('2026-05-16T09:00:00.000Z'),
        updatedAt: new Date('2026-05-16T09:00:00.000Z'),
      },
    ],
  });

  // User uploads for restaurant-3, but expected next is restaurant-2.
  const result = await service.uploadReceipt({
    accessToken: 'user-1',
    restaurantId: 'restaurant-3',
    image: { originalname: 'receipt.png', mimetype: 'image/png', buffer: Buffer.from('x') },
  });

  assert.equal(result.data.routeProgress[0].reason, 'route_order_mismatch');
  assert.deepEqual(result.data.routeProgress[0].visitedRestaurantIds, ['restaurant-1']);
});

test('BR-018 non-active routes are skipped (no progress entry created)', async () => {
  const { service, xpRepository } = createService({
    routes: [
      {
        id: 'route-1',
        routeName: 'Paused Lunch Route',
        city: 'Dhaka',
        restaurantIds: ['restaurant-1'],
        status: 'paused',
        requiredVisits: 1,
        mandatoryOrder: false,
        pointsPerReceiptUpload: 10,
        completionBonus: 0,
        repeatable: false,
        cooldownMinutes: 60,
        createdAt: new Date('2026-06-16T00:00:00.000Z'),
        updatedAt: new Date('2026-06-16T00:00:00.000Z'),
      },
    ],
  });

  const result = await service.uploadReceipt({
    accessToken: 'user-1',
    restaurantId: 'restaurant-1',
    image: { originalname: 'receipt.png', mimetype: 'image/png', buffer: Buffer.from('x') },
  });

  // routeProgress is empty — the paused route is filtered out before any progress is created.
  assert.deepEqual(result.data.routeProgress, []);
  const routeAwards = xpRepository.records.filter((record) =>
    ['route_receipt_upload', 'route_completion'].includes(record.sourceType),
  );
  assert.equal(routeAwards.length, 0);
});

test('BR-018 routes outside their active date window are skipped', async () => {
  const { service, xpRepository } = createService({
    routes: [
      {
        id: 'route-1',
        routeName: 'Future Lunch Route',
        city: 'Dhaka',
        restaurantIds: ['restaurant-1'],
        status: 'active',
        requiredVisits: 1,
        mandatoryOrder: false,
        pointsPerReceiptUpload: 10,
        completionBonus: 0,
        repeatable: false,
        cooldownMinutes: 60,
        // nowProvider is 2026-06-16T09:00:00.000Z; route starts later
        startDate: new Date('2026-07-01T00:00:00.000Z'),
        endDate: new Date('2026-07-14T23:59:59.000Z'),
        createdAt: new Date('2026-06-16T00:00:00.000Z'),
        updatedAt: new Date('2026-06-16T00:00:00.000Z'),
      },
      {
        id: 'route-2',
        routeName: 'Expired Lunch Route',
        city: 'Dhaka',
        restaurantIds: ['restaurant-1'],
        status: 'active',
        requiredVisits: 1,
        mandatoryOrder: false,
        pointsPerReceiptUpload: 10,
        completionBonus: 0,
        repeatable: false,
        cooldownMinutes: 60,
        // route already ended
        startDate: new Date('2026-05-01T00:00:00.000Z'),
        endDate: new Date('2026-05-14T23:59:59.000Z'),
        createdAt: new Date('2026-05-01T00:00:00.000Z'),
        updatedAt: new Date('2026-05-01T00:00:00.000Z'),
      },
    ],
  });

  const result = await service.uploadReceipt({
    accessToken: 'user-1',
    restaurantId: 'restaurant-1',
    image: { originalname: 'receipt.png', mimetype: 'image/png', buffer: Buffer.from('x') },
  });

  assert.deepEqual(result.data.routeProgress, []);
  const routeAwards = xpRepository.records.filter((record) =>
    ['route_receipt_upload', 'route_completion'].includes(record.sourceType),
  );
  assert.equal(routeAwards.length, 0);
});

test('BR-018 repeatable route honours the 7-day repeat cooldown', async () => {
  const { service } = createService({
    routes: [
      {
        id: 'route-1',
        routeName: 'Repeatable Lunch Route',
        city: 'Dhaka',
        restaurantIds: ['restaurant-1'],
        status: 'active',
        requiredVisits: 1,
        mandatoryOrder: false,
        pointsPerReceiptUpload: 10,
        completionBonus: 0,
        repeatable: true,
        cooldownMinutes: 60,
        createdAt: new Date('2026-06-01T00:00:00.000Z'),
        updatedAt: new Date('2026-06-01T00:00:00.000Z'),
      },
    ],
    routeProgress: [
      {
        id: 'progress-1',
        routeId: 'route-1',
        userId: 'user-1',
        status: 'completed',
        visitedRestaurantIds: ['restaurant-1'],
        receiptUploadIds: ['upload-previous'],
        // Completed only 1 day ago — should still be inside the 7-day cooldown.
        completedAt: new Date('2026-06-15T09:00:00.000Z'),
        lastReceiptUploadedAt: new Date('2026-06-15T09:00:00.000Z'),
        createdAt: new Date('2026-06-15T09:00:00.000Z'),
        updatedAt: new Date('2026-06-15T09:00:00.000Z'),
      },
    ],
  });

  const result = await service.uploadReceipt({
    accessToken: 'user-1',
    restaurantId: 'restaurant-1',
    image: { originalname: 'receipt.png', mimetype: 'image/png', buffer: Buffer.from('x') },
  });

  assert.equal(result.data.routeProgress[0].reason, 'route_repeat_cooldown_active');
  assert.equal(result.data.routeProgress[0].status, 'completed');
});

test('BR-018 repeatable route allows restart after the 7-day cooldown', async () => {
  const { service, xpRepository } = createService({
    routes: [
      {
        id: 'route-1',
        routeName: 'Repeatable Lunch Route',
        city: 'Dhaka',
        restaurantIds: ['restaurant-1'],
        status: 'active',
        requiredVisits: 1,
        mandatoryOrder: false,
        pointsPerReceiptUpload: 10,
        completionBonus: 100,
        repeatable: true,
        cooldownMinutes: 60,
        createdAt: new Date('2026-06-01T00:00:00.000Z'),
        updatedAt: new Date('2026-06-01T00:00:00.000Z'),
      },
    ],
    routeProgress: [
      {
        id: 'progress-1',
        routeId: 'route-1',
        userId: 'user-1',
        status: 'completed',
        visitedRestaurantIds: ['restaurant-1'],
        receiptUploadIds: ['upload-previous'],
        // Completed > 7 days ago — repeat is allowed.
        completedAt: new Date('2026-06-01T09:00:00.000Z'),
        lastReceiptUploadedAt: new Date('2026-06-01T09:00:00.000Z'),
        createdAt: new Date('2026-06-01T09:00:00.000Z'),
        updatedAt: new Date('2026-06-01T09:00:00.000Z'),
      },
    ],
  });

  const result = await service.uploadReceipt({
    accessToken: 'user-1',
    restaurantId: 'restaurant-1',
    image: { originalname: 'receipt.png', mimetype: 'image/png', buffer: Buffer.from('x') },
  });

  // Repeat triggered — new in_progress row created with this receipt counted.
  assert.equal(result.data.routeProgress[0].reason, null);
  assert.equal(result.data.routeProgress[0].status, 'completed');
  assert.ok(xpRepository.records.some((record) => record.sourceType === 'route_completion'));
});
