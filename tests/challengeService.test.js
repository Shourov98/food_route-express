import assert from 'node:assert/strict';
import test from 'node:test';

import { ChallengeParticipationService } from '../src/modules/challengeParticipations/challengeParticipationService.js';
import { ChallengeService } from '../src/modules/challenges/challengeService.js';

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
}

class FakeChallengeRepository {
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

class FakeRewardRepository {
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
}

class FakeParticipationRepository {
  constructor(records = []) {
    this.records = new Map(records.map((record) => [record.id, record]));
  }
  async create(record) {
    this.records.set(record.id, record);
    return record;
  }
  async update(id, record) {
    if (!this.records.has(id)) return null;
    this.records.set(id, record);
    return record;
  }
  async getById(id) {
    return this.records.get(id) ?? null;
  }
  async getByUserAndChallenge({ userId, challengeId }) {
    return [...this.records.values()].find((record) => record.userId === userId && record.challengeId === challengeId) ?? null;
  }
  async listByUser(userId) {
    return [...this.records.values()].filter((record) => record.userId === userId);
  }
  async listByChallenge(challengeId) {
    return [...this.records.values()].filter((record) => record.challengeId === challengeId);
  }
}

class FakeCheckInRepository {
  constructor(records = []) {
    this.records = records;
  }
  async listByUser(userId) {
    return this.records.filter((record) => record.userId === userId);
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
  async getByUserAndSource({ userId, sourceType, sourceId }) {
    return [...this.records.values()].find((record) => record.userId === userId && record.sourceType === sourceType && record.sourceId === sourceId) ?? null;
  }
  async delete(id) {
    return this.records.delete(id);
  }
}

class FakeXpService {
  constructor() {
    this.xp = [];
    this.points = [];
  }
  async awardXp({ userId, delta, sourceType, sourceId }) {
    const record = { id: `${sourceType}:${sourceId}:xp`, userId, delta, sourceType, sourceId };
    this.xp.push(record);
    return { id: record.id };
  }
  async awardPoints({ userId, delta, sourceType, sourceId }) {
    const record = { id: `${sourceType}:${sourceId}:points`, userId, delta, sourceType, sourceId };
    this.points.push(record);
    return { id: record.id };
  }
  async deleteXpRecord(id) {
    this.xp = this.xp.filter((item) => item.id !== id);
    return true;
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
    uid: 'user-1',
    fullname: 'Jane Doe',
    email: 'jane@example.com',
    role: 'user',
    isBlocked: false,
    isVerified: true,
    city: 'Dhaka',
    country: 'Bangladesh',
    ...overrides,
  };
}

test('ChallengeService creates and filters challenges with reward validation', async () => {
  const now = new Date();
  const service = new ChallengeService({
    challengeRepository: new FakeChallengeRepository(),
    rewardRepository: new FakeRewardRepository([
      {
        id: 'reward-1',
        isActive: true,
        hasExpiry: false,
        expiresAt: null,
        quantityAvailable: 3,
      },
    ]),
    userRepository: new FakeUserRepository([makeUser({ uid: 'admin-1', role: 'admin' })]),
    identityProvider: new FakeIdentityProvider(),
  });

  const created = await service.createChallenge({
    accessToken: 'admin-1',
    payload: {
      title: 'Weekly Challenge',
      description: 'Complete five check-ins.',
      rewardPoints: 200,
      rewardId: 'reward-1',
      startAt: new Date(now.getTime() - 3_600_000),
      endAt: new Date(now.getTime() + 3_600_000),
      criteria: [{ type: 'check_in_count', requiredCount: 5 }],
      status: null,
    },
  });
  assert.equal(created.status, 'active');

  const listed = await service.listChallenges({
    accessToken: 'admin-1',
    page: 1,
    pageSize: 10,
    search: 'weekly',
    statusFilter: 'active',
  });
  assert.equal(listed.items.length, 1);
});

test('ChallengeParticipationService starts, refreshes, completes, and grants rewards', async () => {
  const now = new Date();
  const firstCheckin = new Date(now.getTime() - 120_000);
  const secondCheckin = new Date(now.getTime() - 60_000);
  const challenge = {
    id: 'challenge-1',
    title: 'Check-in Run',
    description: 'Do two check-ins.',
    rewardPoints: 150,
    rewardId: 'reward-1',
    startAt: new Date(now.getTime() - 86_400_000),
    endAt: new Date(now.getTime() + 86_400_000),
    status: 'active',
    criteria: [{ id: 'criterion-1', type: 'check_in_count', requiredCount: 2 }],
    createdBy: 'admin-1',
    createdAt: now,
    updatedAt: now,
  };
  const reward = {
    id: 'reward-1',
    title: 'Free Coffee',
    description: 'Reward description',
    rewardCategory: 'xp',
    pointsRequired: 0,
    quantityAvailable: 2,
    xpPoints: 10,
    foodItemName: null,
    discountPercentage: null,
    giftCardCode: null,
    termsAndConditions: null,
    imageUrl: null,
    isActive: true,
    hasExpiry: false,
    expiresAt: null,
    createdBy: 'admin-1',
    createdAt: now,
    updatedAt: now,
  };
  const checkinRepository = new FakeCheckInRepository([]);
  const pushNotificationService = new FakePushNotificationService();
  const service = new ChallengeParticipationService({
    challengeRepository: new FakeChallengeRepository([challenge]),
    participationRepository: new FakeParticipationRepository(),
    checkinRepository,
    rewardRepository: new FakeRewardRepository([reward]),
    rewardRedemptionRepository: new FakeRewardRedemptionRepository(),
    userRepository: new FakeUserRepository([makeUser(), makeUser({ uid: 'admin-1', role: 'admin' })]),
    identityProvider: new FakeIdentityProvider(),
    xpService: new FakeXpService(),
    pushNotificationService,
  });

  const started = await service.startChallenge({
    accessToken: 'user-1',
    challengeId: 'challenge-1',
  });
  assert.equal(started.status, 'in_progress');

  const storedRecord = service.participationRepository.records.get(started.id);
  storedRecord.startedAt = new Date(now.getTime() - 3_600_000);

  checkinRepository.records = [
    { id: 'check-1', userId: 'user-1', createdAt: firstCheckin },
    { id: 'check-2', userId: 'user-1', createdAt: secondCheckin },
  ];

  const fetched = await service.getMyParticipation({
    accessToken: 'user-1',
    participationId: started.id,
  });
  assert.equal(fetched.criteria[0].completed, true);
  assert.equal(fetched.progressPercent, 100);
  assert.equal(fetched.status, 'completed');
  assert.equal(fetched.completedAt instanceof Date, true);
  assert.equal(service.xpService.xp.length, 1);
  assert.equal(service.xpService.points.length, 1);
  assert.equal(service.rewardRedemptionRepository.records.size, 1);
  assert.equal(pushNotificationService.messages.length, 1);
  assert.equal(pushNotificationService.messages[0].recipientId, 'user-1');
  assert.equal(pushNotificationService.messages[0].data.type, 'challenge_completed');

  const completed = await service.completeParticipation({
    accessToken: 'user-1',
    participationId: started.id,
  });
  assert.equal(completed.status, 'completed');
  assert.equal(completed.completedAt instanceof Date, true);
  assert.equal(service.xpService.xp.length, 1);
  assert.equal(service.xpService.points.length, 1);
  assert.equal(service.rewardRedemptionRepository.records.size, 1);
});
