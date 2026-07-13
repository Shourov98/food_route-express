import assert from 'node:assert/strict';
import test from 'node:test';

import { RewardService } from '../src/modules/rewards/rewardService.js';
import { DailyRewardService } from '../src/modules/dailyRewards/dailyRewardService.js';
import { RewardRedemptionService } from '../src/modules/rewardRedemptions/rewardRedemptionService.js';
import { SpinService } from '../src/modules/spins/spinService.js';
import { XpService } from '../src/modules/xp/xpService.js';

class FakeUserRepository {
  constructor(users) {
    this.users = new Map(users.map((user) => [user.uid, user]));
  }
  async getByUid(uid) {
    return this.users.get(uid) ?? null;
  }
}

class FakeRewardRepository {
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

class FakeRewardRedemptionRepository {
  constructor(records = []) {
    this.records = new Map(records.map((record) => [record.id, record]));
  }
  async create(record) {
    this.records.set(record.id, record);
    return record;
  }
  async delete(id) {
    return this.records.delete(id);
  }
  async getById(id) {
    return this.records.get(id) ?? null;
  }
  async update(id, record) {
    this.records.set(id, record);
    return record;
  }
  async listByUser(userId) {
    return [...this.records.values()].filter((record) => record.userId === userId);
  }
}

class FakeDailyRewardRepository extends FakeRewardRepository {}

class FakeSpinRepository {
  constructor(records = []) {
    this.records = records;
  }
  async create(record) {
    this.records.push(record);
    return record;
  }
  async listByUser(userId) {
    return this.records.filter((record) => record.userId === userId).sort((a, b) => b.spunAt - a.spunAt);
  }
  async getLatestByUser(userId) {
    return (await this.listByUser(userId))[0] ?? null;
  }
  async listAll() {
    return [...this.records].sort((a, b) => b.spunAt - a.spunAt);
  }
}

class FakeSpinSettingsRepository {
  constructor() {
    this.current = {
      id: 'current',
      resetLogic: 'daily',
      resetTimeUtc: '00:00',
      noRewardProbability: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
  async getCurrent() {
    return this.current;
  }
  async update(record) {
    this.current = { ...record, updatedAt: new Date() };
    return this.current;
  }
}

class FakeIdentityProvider {
  async verifyIdToken(token) {
    return { uid: token };
  }
}

class FakeImageStorage {
  async uploadImage({ folder, file }) {
    return { publicUrl: `https://cdn.example.com/${folder}/${file.originalname}` };
  }
}

class FakePointsRepository {
  constructor() {
    this.records = [];
  }
  async create(record) {
    this.records.push(record);
    return record;
  }
  async listByUser(userId) {
    return this.records.filter((record) => record.userId === userId);
  }
  async getBySource({ sourceType, sourceId, userId }) {
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

class FakeXpRepository extends FakePointsRepository {
  async delete(recordId) {
    const index = this.records.findIndex((record) => record.id === recordId);
    if (index === -1) {
      return false;
    }
    this.records.splice(index, 1);
    return true;
  }
}

class FakeRewardXpService {
  constructor(totalPoints = 0) {
    this.totalPoints = totalPoints;
    this.adjustments = [];
  }

  async getTotalPoints() {
    return this.totalPoints;
  }

  async getTotalXp() {
    return 0;
  }

  async adjustPoints({ userId, delta, sourceId }) {
    this.totalPoints += delta;
    const record = { id: `${sourceId}:points`, userId, delta };
    this.adjustments.push(record);
    return record;
  }
}

class FakePushNotificationService {
  constructor() {
    this.targetingMode = 'external_id';
    this.messages = [];
  }

  async send(message) {
    this.messages.push(message);
    return true;
  }
}

function makeUser(overrides = {}) {
  return {
    uid: 'admin-1',
    role: 'admin',
    isBlocked: false,
    city: 'Dhaka',
    country: 'Bangladesh',
    ...overrides,
  };
}

test('RewardService creates and filters rewards', async () => {
  const service = new RewardService({
    rewardRepository: new FakeRewardRepository(),
    userRepository: new FakeUserRepository([makeUser(), makeUser({ uid: 'user-1', role: 'user' })]),
    identityProvider: new FakeIdentityProvider(),
    imageStorage: new FakeImageStorage(),
  });

  const created = await service.createReward({
    accessToken: 'admin-1',
    payload: {
      title: 'Reward One',
      description: 'Reward description',
      pointsRequired: 100,
      quantityAvailable: 5,
      rewardCategory: 'general_rewards',
      isActive: true,
      hasExpiry: false,
      expiresAt: null,
    },
    image: { originalname: 'reward.png' },
  });

  assert.equal(created.rewardCategory, 'general_rewards');
  const list = await service.listRewards({
    accessToken: 'user-1',
    page: 1,
    pageSize: 10,
    search: 'one',
    statusFilter: 'active',
    isActive: true,
    hasExpiry: null,
    minPoints: null,
    maxPoints: null,
    expiresFrom: null,
    expiresTo: null,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });
  assert.equal(list.items.length, 1);
});

test('DailyRewardService reports low stock analytics', async () => {
  const repository = new FakeDailyRewardRepository([
    {
      id: 'daily-1',
      title: 'Points Reward',
      description: 'Claim a fixed points reward.',
      rewardCategory: 'points',
      pointsReward: 20,
      pointsRequired: 0,
      quantityAvailable: 1,
      probability: 40,
      initialQuantityAvailable: 10,
      imageUrl: null,
      isActive: true,
      hasExpiry: false,
      expiresAt: null,
      createdBy: 'admin-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      lastResetAt: new Date(),
    },
  ]);
  const service = new DailyRewardService({
    dailyRewardRepository: repository,
    userRepository: new FakeUserRepository([makeUser(), makeUser({ uid: 'user-1', role: 'user' })]),
    identityProvider: new FakeIdentityProvider(),
    imageStorage: new FakeImageStorage(),
  });

  const analytics = await service.getAnalytics({ accessToken: 'admin-1' });
  assert.equal(analytics.lowStockRewards, 1);
  assert.equal(analytics.lowStockAlerts.length, 1);
});

test('SpinService awards points and stores spin history', async () => {
  const dailyRewardRepository = new FakeDailyRewardRepository([
    {
      id: 'daily-1',
      title: 'Points Reward',
      description: 'Claim a fixed points reward.',
      rewardCategory: 'points',
      pointsReward: 20,
      pointsRequired: 0,
      quantityAvailable: 3,
      probability: 100,
      initialQuantityAvailable: 3,
      imageUrl: null,
      isActive: true,
      hasExpiry: false,
      expiresAt: null,
      createdBy: 'admin-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      lastResetAt: new Date(),
    },
  ]);
  const pointsRepository = new FakePointsRepository();
  const xpRepository = new FakeXpRepository();
  const spinService = new SpinService({
    dailyRewardRepository,
    spinRepository: new FakeSpinRepository(),
    spinSettingsRepository: new FakeSpinSettingsRepository(),
    userRepository: new FakeUserRepository([makeUser({ uid: 'user-1', role: 'user' })]),
    identityProvider: new FakeIdentityProvider(),
    xpService: new XpService({
      xpRepository,
      pointsRepository,
    }),
    randomNumber: () => 0,
  });

  const result = await spinService.spin({ accessToken: 'user-1' });
  assert.equal(result.spin.rewardId, 'daily-1');
  assert.equal(result.remainingQuantityAvailable, 2);
  assert.equal(pointsRepository.records.length, 1);
  assert.equal(xpRepository.records.length, 1);
});

test('RewardRedemptionService redeems reward and sends reward-claimed push', async () => {
  const now = new Date();
  const pushNotificationService = new FakePushNotificationService();
  const xpService = new FakeRewardXpService(200);
  const rewardRepository = new FakeRewardRepository([
    {
      id: 'reward-1',
      title: '20% Off Coupon',
      description: 'Discount reward',
      rewardImageUrl: null,
      rewardCategory: 'coupon',
      pointsRequired: 100,
      quantityAvailable: 5,
      xpPoints: 0,
      foodItemName: null,
      discountPercentage: 20,
      giftCardCode: null,
      termsAndConditions: null,
      imageUrl: null,
      isActive: true,
      hasExpiry: false,
      expiresAt: null,
      createdAt: now,
      updatedAt: now,
    },
  ]);
  const service = new RewardRedemptionService({
    rewardRepository,
    rewardRedemptionRepository: new FakeRewardRedemptionRepository(),
    userRepository: new FakeUserRepository([makeUser({ uid: 'user-1', role: 'user' })]),
    identityProvider: new FakeIdentityProvider(),
    xpService,
    pushNotificationService,
  });

  const result = await service.redeemReward({
    accessToken: 'user-1',
    rewardId: 'reward-1',
  });

  assert.equal(result.redemption.status, 'pending');
  assert.equal(typeof result.redemption.redemptionCode, 'string');
  assert.ok(result.redemption.expiresAt instanceof Date);
  assert.equal(pushNotificationService.messages.length, 1);
  assert.equal(pushNotificationService.messages[0].recipientId, 'user-1');
  assert.equal(pushNotificationService.messages[0].data.type, 'reward_claimed');
});

test('RewardRedemptionService rejects duplicate reward redemption by the same user', async () => {
  const now = new Date();
  const xpService = new FakeRewardXpService(300);
  const rewardRepository = new FakeRewardRepository([
    {
      id: 'reward-1',
      title: '20% Off Coupon',
      description: 'Discount reward',
      rewardImageUrl: null,
      rewardCategory: 'coupon',
      pointsRequired: 100,
      quantityAvailable: 5,
      xpPoints: 0,
      foodItemName: null,
      discountPercentage: 20,
      giftCardCode: null,
      termsAndConditions: null,
      imageUrl: null,
      isActive: true,
      hasExpiry: false,
      expiresAt: null,
      createdAt: now,
      updatedAt: now,
    },
  ]);
  const redemptionRepository = new FakeRewardRedemptionRepository([
    {
      id: 'redemption-1',
      rewardId: 'reward-1',
      userId: 'user-1',
      status: 'pending',
      redeemedAt: now,
      createdAt: now,
      updatedAt: now,
    },
  ]);
  const service = new RewardRedemptionService({
    rewardRepository,
    rewardRedemptionRepository: redemptionRepository,
    userRepository: new FakeUserRepository([makeUser({ uid: 'user-1', role: 'user' })]),
    identityProvider: new FakeIdentityProvider(),
    xpService,
  });

  await assert.rejects(
    service.redeemReward({
      accessToken: 'user-1',
      rewardId: 'reward-1',
    }),
    (error) => error.code === 'reward_already_redeemed',
  );
});

test('RewardRedemptionService rejects the fourth reward redemption in one UTC day', async () => {
  const now = new Date();
  const xpService = new FakeRewardXpService(500);
  const rewardRepository = new FakeRewardRepository([
    {
      id: 'reward-4',
      title: 'Fourth Coupon',
      description: 'Discount reward',
      rewardImageUrl: null,
      rewardCategory: 'coupon',
      pointsRequired: 100,
      quantityAvailable: 5,
      xpPoints: 0,
      foodItemName: null,
      discountPercentage: 20,
      giftCardCode: null,
      termsAndConditions: null,
      imageUrl: null,
      isActive: true,
      hasExpiry: false,
      expiresAt: null,
      createdAt: now,
      updatedAt: now,
    },
  ]);
  const redemptionRepository = new FakeRewardRedemptionRepository(
    [1, 2, 3].map((index) => ({
      id: `redemption-${index}`,
      rewardId: `reward-${index}`,
      userId: 'user-1',
      status: 'pending',
      redeemedAt: now,
      createdAt: now,
      updatedAt: now,
    })),
  );
  const service = new RewardRedemptionService({
    rewardRepository,
    rewardRedemptionRepository: redemptionRepository,
    userRepository: new FakeUserRepository([makeUser({ uid: 'user-1', role: 'user' })]),
    identityProvider: new FakeIdentityProvider(),
    xpService,
  });

  await assert.rejects(
    service.redeemReward({
      accessToken: 'user-1',
      rewardId: 'reward-4',
    }),
    (error) => error.code === 'daily_reward_redemption_limit_reached',
  );
});
