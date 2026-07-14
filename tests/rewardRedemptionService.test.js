import assert from 'node:assert/strict';
import test from 'node:test';

import { ApplicationError } from '../src/core/ApplicationError.js';
import { RewardRedemptionService } from '../src/modules/rewardRedemptions/rewardRedemptionService.js';

// ---------------------------------------------------------------------------
// BR-006 Reward Redemption service tests
//
// These tests focus on the three race conditions that motivated the
// transactional refactor of `redeemReward`:
//   1. Stock oversell (non-atomic read-then-write of quantityAvailable)
//   2. Duplicate same-user same-reward redemption
//   3. Daily-limit TOCTOU
//
// The fakes simulate SERIALIZABLE isolation by routing every read+write
// through a SHARED transaction lock (a single promise chain shared by
// all fake repositories) — mirroring how production Firestore
// `runTransaction` serializes the entire critical section. While a
// transaction is active, per-method locks are skipped (reentrancy).
// Concurrent calls are forced to take turns, so the assertions can
// reproduce race scenarios deterministically.
// ---------------------------------------------------------------------------

class FakeIdentityProvider {
  async verifyIdToken(token) {
    return { uid: token };
  }
}

class FakeUserRepository {
  constructor(users) {
    this.users = new Map(users.map((user) => [user.uid, user]));
  }
  async getByUid(uid) {
    return this.users.get(uid) ?? null;
  }
  setUser(user) {
    this.users.set(user.uid, user);
  }
}

// Shared transaction context. All fakes that participate in a
// transaction reference the same `_txnLock` so concurrent calls are
// serialized end-to-end. This mirrors Firestore's behavior where a
// `runTransaction` body holds the SERIALIZABLE lock across reads and
// writes of multiple documents/collections.
//
// `depth` counts how many transactions are currently active on this
// lock — incremented before a body runs and decremented after. While
// depth > 0, per-method `_runExclusive` calls skip their own queueing
// (reentrancy from within an in-progress body).
function createTxnLock() {
  return {
    chain: Promise.resolve(),
    depth: 0,
  };
}

// Serializes `fn` against the shared lock's promise chain. Increments
// `depth` for the duration of `fn` so nested `_runExclusive` calls
// inside the body skip their own queueing.
function withSharedTxn(lock, fn) {
  lock.depth += 1;
  const next = lock.chain.then(
    async () => {
      try {
        return await fn();
      } finally {
        lock.depth -= 1;
      }
    },
    async () => {
      try {
        return await fn();
      } finally {
        lock.depth -= 1;
      }
    },
  );
  lock.chain = next.catch(() => undefined);
  return next;
}

// Mixin that wires a fake repository into a shared transaction lock.
// The lock has a depth counter so concurrent transactions properly
// serialize via the shared promise chain while per-method reentrancy
// is still safe.
function bindSharedTxn(fake, lock) {
  fake._txnLock = lock;
  // Per-method serialization uses the shared lock when the lock's
  // depth is 0 (no active transaction); skips the lock when the lock
  // has any active holder (reentrant within the current txn).
  fake._runExclusive = (fn) => {
    if (lock.depth > 0) return fn();
    return withSharedTxn(lock, fn);
  };
  // Allow the service code to look up a shared coordinator without
  // knowing which fake was used.
  if (!lock.__coordinator) {
    lock.__coordinator = { run: null };
  }
  fake.__txnCoordinator = lock.__coordinator;
}

class FakeRewardRepository {
  constructor(records = [], options = {}) {
    this.records = new Map(records.map((record) => [record.id, record]));
    bindSharedTxn(this, options.txnLock ?? createTxnLock());
  }

  async create(record) {
    return this._runExclusive(() => {
      this.records.set(record.id, record);
      return record;
    });
  }

  async update(id, record) {
    return this._runExclusive(() => {
      const previous = this.records.get(id);
      if (!previous) return null;
      this.records.set(id, record);
      return record;
    });
  }

  async getById(id) {
    const record = this.records.get(id);
    return record ? { ...record } : null;
  }

  async listAll() {
    return [...this.records.values()];
  }

  async delete(id) {
    this.records.delete(id);
    return true;
  }
}

class FakeRewardRedemptionRepository {
  constructor(records = [], options = {}) {
    this.records = new Map(records.map((record) => [record.id, record]));
    bindSharedTxn(this, options.txnLock ?? createTxnLock());
  }

  async create(record) {
    return this._runExclusive(() => {
      this.records.set(record.id, record);
      return { ...record };
    });
  }

  async delete(id) {
    return this._runExclusive(() => this.records.delete(id));
  }

  async getById(id) {
    const record = this.records.get(id);
    return record ? { ...record } : null;
  }

  async update(id, record) {
    return this._runExclusive(() => {
      const previous = this.records.get(id);
      if (!previous) return null;
      this.records.set(id, record);
      return { ...record };
    });
  }

  async listByUser(userId) {
    return [...this.records.values()].filter((record) => record.userId === userId);
  }

  async listAll() {
    return [...this.records.values()];
  }

  async findByCode({ code }) {
    return (
      [...this.records.values()].find((record) => record.redemptionCode === code) ?? null
    );
  }

  async findActiveRedemptionInTxn({ userId, rewardId }) {
    // Route the read through the same per-method lock that serializes
    // writes, so concurrent calls see a consistent snapshot — same effect
    // as Firestore's SERIALIZABLE isolation.
    return this._runExclusive(() => {
      const result = (
        [...this.records.values()].find(
          (record) =>
            record.userId === userId &&
            record.rewardId === rewardId &&
            ['pending', 'claimed', 'used', 'redeemed'].includes(record.status),
        ) ?? null
      );
      return result;
    });
  }

  async countTodayRedemptionsInTxn({ userId, now }) {
    const startOfDay = new Date(now);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setUTCHours(23, 59, 59, 999);
    return this._runExclusive(() => {
      return [...this.records.values()].filter((record) => {
        if (record.userId !== userId) return false;
        const redeemedAt = record.redeemedAt ?? record.createdAt;
        if (!redeemedAt) return false;
        const time = new Date(redeemedAt).getTime();
        return time >= startOfDay.getTime() && time <= endOfDay.getTime();
      }).length;
    });
  }

  async listByUserInTxn(userId) {
    return this._runExclusive(() => {
      return [...this.records.values()].filter(
        (record) => record.userId === userId,
      );
    });
  }
}

class FakePointsRepository {
  constructor(records = [], options = {}) {
    this.records = records;
    bindSharedTxn(this, options.txnLock ?? createTxnLock());
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
      if (existing) return null;
      this.records.push(record);
      return record;
    });
  }

  async listByUser(userId) {
    return this.records.filter((record) => record.userId === userId);
  }

  async delete(recordId) {
    return this._runExclusive(() => {
      const index = this.records.findIndex((record) => record.id === recordId);
      if (index === -1) return false;
      this.records.splice(index, 1);
      return true;
    });
  }
}

class FakeXpRepository extends FakePointsRepository {}

// Coordinates a "transaction" across all the fakes that share a lock.
// In this simplified version, `withSharedTxn` already increments
// `lock.depth` for the duration of the body, so per-method
// `_runExclusive` calls inside the body correctly detect the active
// transaction and skip their own queueing. The coordinator is just a
// thin wrapper so the service code can invoke it the same way it would
// invoke Firestore's `runTransaction`.
class FakeTransactionCoordinator {
  constructor(lock, _fakes) {
    this.lock = lock;
    if (lock.__coordinator) {
      lock.__coordinator.run = (body) => this.run(body);
    }
  }
  run(body) {
    return withSharedTxn(this.lock, body);
  }
}

class FakeRewardXpService {
  constructor({ totalPoints = 0, totalXp = 0 } = {}, options = {}) {
    this.totalPoints = totalPoints;
    this.totalXp = totalXp;
    this.pointsRepository = new FakePointsRepository([], options);
    this.xpRepository = new FakeXpRepository([], options);
    this.adjustments = [];
  }

  async getTotalPoints(_userId) {
    return this.totalPoints;
  }

  async getTotalXp(_userId) {
    return this.totalXp;
  }

  async adjustPoints({ userId, delta, sourceId }) {
    this.totalPoints += delta;
    const record = {
      id: `${sourceId}:points`,
      userId,
      delta,
      sourceId,
      balanceBefore: this.totalPoints - delta,
      balanceAfter: this.totalPoints,
    };
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
    uid: 'user-1',
    fullname: 'Jane Doe',
    email: 'user@example.com',
    city: 'Dhaka',
    country: 'Bangladesh',
    role: 'user',
    isBlocked: false,
    isVerified: true,
    pushNotificationToken: 'token',
    pushNotificationPlatform: 'android',
    ...overrides,
  };
}

function makeReward(overrides = {}) {
  const now = new Date();
  return {
    id: 'reward-1',
    title: 'Bluetooth Headphones',
    description: 'Premium wireless headphones',
    rewardImageUrl: 'https://cdn.example.com/headphones.png',
    rewardCategory: 'general_rewards',
    pointsRequired: 100,
    quantityAvailable: 5,
    xpPoints: null,
    foodItemName: null,
    discountPercentage: null,
    giftCardCode: null,
    termsAndConditions: null,
    imageUrl: 'https://cdn.example.com/headphones.png',
    isActive: true,
    hasExpiry: false,
    expiresAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createService({
  user = makeUser(),
  reward = makeReward(),
  redemptions = [],
  totalPoints = 200,
  users = null,
  sharedLock = null,
} = {}) {
  // One lock shared across all fake repositories so the test fallback
  // can wrap reads and writes in a single SERIALIZABLE "transaction".
  const txnLock = sharedLock ?? createTxnLock();
  const xpService = new FakeRewardXpService({ totalPoints }, { txnLock });
  const rewardRepository = new FakeRewardRepository([reward], { txnLock });
  const rewardRedemptionRepository = new FakeRewardRedemptionRepository(
    redemptions,
    { txnLock },
  );
  const pointsRepository = xpService.pointsRepository;
  const txnCoordinator = new FakeTransactionCoordinator(txnLock, [
    rewardRepository,
    rewardRedemptionRepository,
    pointsRepository,
    xpService.xpRepository,
  ]);
  const userList = users ?? [user];
  return {
    service: new RewardRedemptionService({
      rewardRepository,
      rewardRedemptionRepository,
      userRepository: new FakeUserRepository(userList),
      identityProvider: new FakeIdentityProvider(),
      xpService,
      pointsRepository,
      pushNotificationService: new FakePushNotificationService(),
    }),
    rewardRepository,
    rewardRedemptionRepository,
    pointsRepository,
    xpService,
    txnCoordinator,
    txnLock,
  };
}

// ---------------------------------------------------------------------------
// Happy-path + validation tests
// ---------------------------------------------------------------------------

test('RewardRedemptionService.redeemReward succeeds and decrements stock by one', async () => {
  const { service, rewardRepository, rewardRedemptionRepository } = createService();

  const result = await service.redeemReward({
    accessToken: 'user-1',
    rewardId: 'reward-1',
  });

  assert.equal(result.redemption.status, 'pending');
  assert.equal(result.redemption.userId, 'user-1');
  assert.equal(result.redemption.rewardId, 'reward-1');
  assert.equal(result.redemption.pointsRequired, 100);
  assert.equal(result.remainingQuantityAvailable, 4);
  assert.match(
    result.redemption.redemptionCode,
    /^[A-F0-9-]+$/,
    'redemptionCode should be UUIDv4 (uppercase hex with dashes)',
  );
  assert.ok(result.redemption.expiresAt instanceof Date);
  assert.equal(result.userPointsAfter, 100);

  const stored = rewardRedemptionRepository.records.get(result.redemption.id);
  assert.ok(stored, 'redemption should be persisted');
  assert.equal(stored.status, 'pending');

  const updatedReward = await rewardRepository.getById('reward-1');
  assert.equal(updatedReward.quantityAvailable, 4, 'stock should be decremented to 4');
});

test('RewardRedemptionService.redeemReward rejects inactive reward (reward_inactive)', async () => {
  const { service } = createService({ reward: makeReward({ isActive: false }) });

  await assert.rejects(
    service.redeemReward({ accessToken: 'user-1', rewardId: 'reward-1' }),
    (error) => error.code === 'reward_inactive' && error.statusCode === 400,
  );
});

test('RewardRedemptionService.redeemReward rejects expired reward (reward_expired)', async () => {
  const pastDate = new Date('2020-01-01T00:00:00.000Z');
  const { service } = createService({
    reward: makeReward({ hasExpiry: true, expiresAt: pastDate }),
  });

  await assert.rejects(
    service.redeemReward({ accessToken: 'user-1', rewardId: 'reward-1' }),
    (error) => error.code === 'reward_expired' && error.statusCode === 400,
  );
});

test('RewardRedemptionService.redeemReward rejects zero-stock reward (reward_out_of_stock)', async () => {
  const { service } = createService({ reward: makeReward({ quantityAvailable: 0 }) });

  await assert.rejects(
    service.redeemReward({ accessToken: 'user-1', rewardId: 'reward-1' }),
    (error) => error.code === 'reward_out_of_stock' && error.statusCode === 400,
  );
});

test('RewardRedemptionService.redeemReward rejects insufficient wallet points', async () => {
  const { service } = createService({ totalPoints: 50 });

  await assert.rejects(
    service.redeemReward({ accessToken: 'user-1', rewardId: 'reward-1' }),
    (error) =>
      error.code === 'insufficient_reward_points' && error.statusCode === 400,
  );
});

test('RewardRedemptionService.redeemReward rejects duplicate same-user same-reward active redemption', async () => {
  const now = new Date();
  const { service } = createService({
    redemptions: [
      {
        id: 'existing-1',
        rewardId: 'reward-1',
        userId: 'user-1',
        status: 'pending',
        redeemedAt: now,
        createdAt: now,
        updatedAt: now,
      },
    ],
  });

  await assert.rejects(
    service.redeemReward({ accessToken: 'user-1', rewardId: 'reward-1' }),
    (error) =>
      error.code === 'reward_already_redeemed' && error.statusCode === 409,
  );
});

test('RewardRedemptionService.redeemReward allows a NEW redemption if previous was cancelled', async () => {
  const now = new Date();
  const { service } = createService({
    redemptions: [
      {
        id: 'old-1',
        rewardId: 'reward-1',
        userId: 'user-1',
        status: 'cancelled',
        redeemedAt: now,
        createdAt: now,
        updatedAt: now,
      },
    ],
  });

  const result = await service.redeemReward({
    accessToken: 'user-1',
    rewardId: 'reward-1',
  });

  assert.equal(result.redemption.status, 'pending');
});

// ---------------------------------------------------------------------------
// Race-condition tests (the whole point of this PR)
// ---------------------------------------------------------------------------

test('BR-006 race: two concurrent redemptions against quantityAvailable=1 — only one succeeds, stock never negative', async () => {
  const sharedLock = createTxnLock();
  const { service, rewardRepository } = createService({
    reward: makeReward({ quantityAvailable: 1 }),
    totalPoints: 200,
    sharedLock,
    users: [
      makeUser({ uid: 'user-1' }),
      makeUser({ uid: 'user-2', email: 'two@example.com' }),
    ],
  });

  const results = await Promise.allSettled([
    service.redeemReward({ accessToken: 'user-1', rewardId: 'reward-1' }),
    service.redeemReward({ accessToken: 'user-2', rewardId: 'reward-1' }),
  ]);

  const fulfilled = results.filter((r) => r.status === 'fulfilled');
  const rejected = results.filter((r) => r.status === 'rejected');

  assert.equal(
    fulfilled.length,
    1,
    'with stock=1 and two concurrent callers, only one redemption can succeed',
  );
  assert.equal(
    rejected.length,
    1,
    'the other caller should receive reward_out_of_stock',
  );
  assert.equal(
    rejected[0].reason?.code,
    'reward_out_of_stock',
    'rejected caller should see reward_out_of_stock',
  );

  const finalReward = await rewardRepository.getById('reward-1');
  assert.equal(
    finalReward.quantityAvailable,
    0,
    'stock should end at exactly 0, never negative (no oversell)',
  );
});

test('BR-006 race: two concurrent same-user same-reward redemptions — only one succeeds', async () => {
  const sharedLock = createTxnLock();
  const { service, rewardRepository, xpService } = createService({
    reward: makeReward({ quantityAvailable: 5 }),
    totalPoints: 500,
    sharedLock,
  });

  // Same user — simulate tapping "Redeem" twice in rapid succession
  // (e.g. double-tap on a slow network).
  const results = await Promise.allSettled([
    service.redeemReward({ accessToken: 'user-1', rewardId: 'reward-1' }),
    service.redeemReward({ accessToken: 'user-1', rewardId: 'reward-1' }),
  ]);

  const fulfilled = results.filter((r) => r.status === 'fulfilled');
  const rejected = results.filter((r) => r.status === 'rejected');

  assert.equal(fulfilled.length, 1, 'only one redemption should succeed');
  assert.equal(rejected.length, 1, 'the duplicate should be rejected');
  assert.equal(
    rejected[0].reason?.code,
    'reward_already_redeemed',
    'duplicate should produce reward_already_redeemed',
  );

  const finalReward = await rewardRepository.getById('reward-1');
  assert.equal(finalReward.quantityAvailable, 4, 'stock should drop by 1 only');

  assert.equal(xpService.totalPoints, 400, 'wallet should drop by 100 exactly once');
});

test('BR-006 race: 5 concurrent redemptions with stock=3 produce exactly 3 successes', async () => {
  const sharedLock = createTxnLock();
  const { service, rewardRepository } = createService({
    reward: makeReward({ quantityAvailable: 3 }),
    totalPoints: 2000,
    sharedLock,
    users: Array.from({ length: 5 }, (_, i) =>
      makeUser({ uid: `user-${i + 1}`, email: `u${i + 1}@example.com` }),
    ),
  });

  const results = await Promise.allSettled(
    [1, 2, 3, 4, 5].map((i) =>
      service.redeemReward({ accessToken: `user-${i}`, rewardId: 'reward-1' }),
    ),
  );

  const fulfilled = results.filter((r) => r.status === 'fulfilled');
  const rejected = results.filter((r) => r.status === 'rejected');

  assert.equal(fulfilled.length, 3, 'only 3 of 5 should succeed against stock=3');
  assert.equal(rejected.length, 2);
  for (const r of rejected) {
    assert.ok(
      ['reward_out_of_stock', 'reward_already_redeemed'].includes(r.reason?.code),
      `rejected callers should see stock-related errors, got ${r.reason?.code}`,
    );
  }

  const finalReward = await rewardRepository.getById('reward-1');
  assert.equal(finalReward.quantityAvailable, 0, 'stock should end at exactly 0');
});

test('BR-006 race: 5 concurrent same-user redemptions against 5 different rewards produce exactly 3 successes (daily cap=3)', async () => {
  const sharedLock = createTxnLock();
  const rewards = Array.from({ length: 5 }, (_, i) =>
    makeReward({ id: `reward-${i + 1}`, quantityAvailable: 5 }),
  );
  const { service, rewardRepository: _rr } = createService({
    reward: rewards[0],
    totalPoints: 2000,
    sharedLock,
  });
  // Inject the additional rewards into the shared-lock reward repo.
  // We use `create` (not `update`) so rewards that don't exist yet are
  // stored — `update` returns null for missing records.
  for (const r of rewards.slice(1)) {
    await service.rewardRepository.create(r);
  }

  // Same user, 5 different rewards → 3 should succeed (MAX_DAILY_REDEMPTIONS),
  // 2 should be rejected with daily_reward_redemption_limit_reached.
  const results = await Promise.allSettled(
    [1, 2, 3, 4, 5].map((i) =>
      service.redeemReward({ accessToken: 'user-1', rewardId: `reward-${i}` }),
    ),
  );

  const fulfilled = results.filter((r) => r.status === 'fulfilled');
  const rejected = results.filter((r) => r.status === 'rejected');

  assert.equal(
    fulfilled.length,
    3,
    'with daily cap=3, exactly 3 of 5 concurrent same-user calls should succeed',
  );
  assert.equal(rejected.length, 2);
  for (const r of rejected) {
    assert.equal(
      r.reason?.code,
      'daily_reward_redemption_limit_reached',
      'rejected calls should hit the daily cap',
    );
  }
});

// ---------------------------------------------------------------------------
// Ranking-points invariant (BR-006: do not modify Ranking Points)
// ---------------------------------------------------------------------------

test('RewardRedemptionService.redeemReward never writes to the XP ledger', async () => {
  const { service, xpService } = createService();

  await service.redeemReward({ accessToken: 'user-1', rewardId: 'reward-1' });

  // The fake's `adjustments` array captures every wallet deduction — the
  // production code routes through `pointsRepository.createIfAbsent`, but
  // the test fallback calls `xpService.adjustPoints` (which the fake
  // records in `adjustments`). Either way, XP ledger must stay empty.
  assert.equal(
    xpService.xpRepository.records.length,
    0,
    'xp_ledger should remain empty after a wallet deduction',
  );
  assert.ok(
    xpService.adjustments.length >= 1,
    'wallet deduction should be recorded',
  );
  const deduction = xpService.adjustments[0];
  assert.equal(deduction.delta, -100);
  assert.equal(deduction.userId, 'user-1');
});

// ---------------------------------------------------------------------------
// Code uniqueness (UUIDv4 + Firestore pre-check)
// ---------------------------------------------------------------------------

test('RewardRedemptionService generates a UUIDv4-shaped redemption code', async () => {
  const { service } = createService();

  const result = await service.redeemReward({
    accessToken: 'user-1',
    rewardId: 'reward-1',
  });

  // UUIDv4 form: 8-4-4-4-12 with dashes, uppercase hex digits.
  assert.match(
    result.redemption.redemptionCode,
    /^[A-F0-9]{8}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{12}$/,
    `expected UUIDv4 form, got ${result.redemption.redemptionCode}`,
  );
});

// ---------------------------------------------------------------------------
// redeemOwnedReward (user marks their own redemption as used)
// ---------------------------------------------------------------------------

test('RewardRedemptionService.redeemOwnedReward moves pending → used and sets usedAt', async () => {
  const now = new Date();
  const futureExpiry = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const { service } = createService({
    redemptions: [
      {
        id: 'redemption-1',
        rewardId: 'reward-1',
        userId: 'user-1',
        status: 'pending',
        redeemedAt: now,
        usedAt: null,
        expiresAt: futureExpiry,
        createdAt: now,
        updatedAt: now,
        redemptionCode: 'CODE-1',
        rewardTitle: 'Bluetooth Headphones',
        rewardImageUrl: null,
        rewardCategory: 'general_rewards',
        pointsRequired: 100,
      },
    ],
  });

  const result = await service.redeemOwnedReward({
    accessToken: 'user-1',
    redemptionId: 'redemption-1',
  });

  assert.equal(result.redemption.status, 'used');
  assert.ok(result.redemption.usedAt instanceof Date);
});

test('RewardRedemptionService.redeemOwnedReward rejects already-used redemption', async () => {
  const now = new Date();
  const futureExpiry = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const { service } = createService({
    redemptions: [
      {
        id: 'redemption-1',
        rewardId: 'reward-1',
        userId: 'user-1',
        status: 'used',
        redeemedAt: now,
        usedAt: now,
        expiresAt: futureExpiry,
        createdAt: now,
        updatedAt: now,
        redemptionCode: 'CODE-1',
        rewardTitle: 'Bluetooth Headphones',
        rewardImageUrl: null,
        rewardCategory: 'general_rewards',
        pointsRequired: 100,
      },
    ],
  });

  await assert.rejects(
    service.redeemOwnedReward({ accessToken: 'user-1', redemptionId: 'redemption-1' }),
    (error) =>
      error.code === 'redemption_already_used' && error.statusCode === 400,
  );
});

test('RewardRedemptionService.redeemOwnedReward rejects expired redemption', async () => {
  const past = new Date('2020-01-01T00:00:00.000Z');
  const { service } = createService({
    redemptions: [
      {
        id: 'redemption-1',
        rewardId: 'reward-1',
        userId: 'user-1',
        status: 'pending',
        redeemedAt: past,
        usedAt: null,
        expiresAt: past,
        createdAt: past,
        updatedAt: past,
        redemptionCode: 'CODE-1',
        rewardTitle: 'Bluetooth Headphones',
        rewardImageUrl: null,
        rewardCategory: 'general_rewards',
        pointsRequired: 100,
      },
    ],
  });

  await assert.rejects(
    service.redeemOwnedReward({ accessToken: 'user-1', redemptionId: 'redemption-1' }),
    (error) => error.code === 'redemption_expired' && error.statusCode === 400,
  );
});

test('RewardRedemptionService.redeemOwnedReward rejects cross-user lookup', async () => {
  const now = new Date();
  const futureExpiry = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const { service } = createService({
    redemptions: [
      {
        id: 'redemption-1',
        rewardId: 'reward-1',
        userId: 'some-other-user',
        status: 'pending',
        redeemedAt: now,
        usedAt: null,
        expiresAt: futureExpiry,
        createdAt: now,
        updatedAt: now,
        redemptionCode: 'CODE-1',
        rewardTitle: 'Bluetooth Headphones',
        rewardImageUrl: null,
        rewardCategory: 'general_rewards',
        pointsRequired: 100,
      },
    ],
  });

  await assert.rejects(
    service.redeemOwnedReward({ accessToken: 'user-1', redemptionId: 'redemption-1' }),
    (error) => error.code === 'redemption_not_found' && error.statusCode === 404,
  );
});

// ---------------------------------------------------------------------------
// Admin status update
// ---------------------------------------------------------------------------

test('RewardRedemptionService.updateAdminRedemptionStatus accepts all 5 admin statuses', async () => {
  const now = new Date();
  const futureExpiry = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const { service } = createService({
    redemptions: [
      {
        id: 'redemption-1',
        rewardId: 'reward-1',
        userId: 'user-1',
        status: 'pending',
        redeemedAt: now,
        usedAt: null,
        expiresAt: futureExpiry,
        createdAt: now,
        updatedAt: now,
        redemptionCode: 'CODE-1',
        rewardTitle: 'Bluetooth Headphones',
        rewardImageUrl: null,
        rewardCategory: 'general_rewards',
        pointsRequired: 100,
      },
    ],
  });

  // Promote the test user to super_admin so the admin endpoints accept it.
  service.userRepository.setUser({
    ...makeUser({ uid: 'user-1', role: 'super_admin' }),
  });

  for (const status of ['used', 'expired', 'cancelled', 'rejected']) {
    const updated = await service.updateAdminRedemptionStatus({
      accessToken: 'user-1',
      redemptionId: 'redemption-1',
      status,
    });
    assert.equal(updated.status, status);
  }
});

test('RewardRedemptionService.updateAdminRedemptionStatus rejects invalid status', async () => {
  const { service } = createService();

  service.userRepository.setUser({
    ...makeUser({ uid: 'user-1', role: 'super_admin' }),
  });

  await assert.rejects(
    service.updateAdminRedemptionStatus({
      accessToken: 'user-1',
      redemptionId: 'redemption-1',
      status: 'invalid',
    }),
    (error) =>
      error instanceof ApplicationError &&
      error.code === 'validation_error' &&
      error.statusCode === 422,
  );
});
