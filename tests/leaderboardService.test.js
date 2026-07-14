import assert from 'node:assert/strict';
import test from 'node:test';

import { ApplicationError } from '../src/core/ApplicationError.js';
import { LeaderboardService } from '../src/modules/leaderboard/leaderboardService.js';
import {
  EARNING_SOURCE_TYPES,
  isEarningSourceType,
  RANKING_DESCRIPTION,
} from '../src/modules/leaderboard/rankingPolicy.js';

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

  async updateFields(uid, fields) {
    const user = this.users.get(uid);
    if (!user) return null;
    Object.assign(user, fields);
    return user;
  }
}

class FakeIdentityProvider {
  constructor(currentUid = 'user-1') {
    this.currentUid = currentUid;
  }

  async verifyIdToken() {
    return { uid: this.currentUid, email: `${this.currentUid}@example.com` };
  }
}

class FakeXpRepository {
  constructor(records = []) {
    this.records = records;
  }

  async listByUser(userId) {
    return this.records.filter((record) => record.userId === userId);
  }
}

class FakePointsRepository {
  constructor(records = []) {
    this.records = records;
  }

  async listByUser(userId) {
    return this.records.filter((record) => record.userId === userId);
  }
}

function makeUser(overrides = {}) {
  return {
    uid: 'user-1',
    fullname: 'Jane Doe',
    email: 'user@example.com',
    gender: 'female',
    age: 28,
    city: 'Dhaka',
    country: 'Bangladesh',
    profileImageUrl: null,
    referralCode: 'ABCDEFGH',
    referredByUid: null,
    referralBonusAwarded: false,
    role: 'user',
    isVerified: true,
    isBlocked: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    proximityAlertsEnabled: false,
    proximityDistanceKm: null,
    lastKnownLatitude: null,
    lastKnownLongitude: null,
    ...overrides,
  };
}

function createService({
  user = makeUser(),
  xpRecords = [],
  pointRecords = [],
  identityProvider,
} = {}) {
  return new LeaderboardService({
    userRepository: new FakeUserRepository([user]),
    identityProvider: identityProvider ?? new FakeIdentityProvider(user.uid),
    xpRepository: new FakeXpRepository(xpRecords),
    pointsRepository: new FakePointsRepository(pointRecords),
  });
}

function xpRecord({
  userId = 'user-1',
  sourceType,
  xpDelta,
  createdAt = new Date('2026-06-01T12:00:00.000Z'),
  sourceId = `${sourceType}-${userId}-${xpDelta}`,
}) {
  return {
    id: `xp-${userId}-${sourceType}-${xpDelta}-${sourceId}`,
    userId,
    sourceType,
    sourceId,
    xpDelta,
    createdAt,
  };
}

function pointsRecord({
  userId = 'user-1',
  sourceType,
  pointsDelta,
  createdAt = new Date('2026-06-01T12:00:00.000Z'),
  sourceId = `${sourceType}-${userId}-${pointsDelta}`,
}) {
  return {
    id: `pt-${userId}-${sourceType}-${pointsDelta}-${sourceId}`,
    userId,
    sourceType,
    sourceId,
    pointsDelta,
    createdAt,
  };
}

// ---------------------------------------------------------------------------
// rankingPolicy module
// ---------------------------------------------------------------------------

test('rankingPolicy EARNING_SOURCE_TYPES contains only the 7 documented earning flows', () => {
  assert.deepEqual(
    [...EARNING_SOURCE_TYPES].sort(),
    [
      'challenge_completion',
      'check_in',
      'daily_reward_spin',
      'receipt_upload',
      'route_completion',
      'route_receipt_upload',
      'social_share',
    ],
  );
});

test('rankingPolicy isEarningSourceType() excludes admin_adjustment and unknown types', () => {
  assert.equal(isEarningSourceType('check_in'), true);
  assert.equal(isEarningSourceType('social_share'), true);
  assert.equal(isEarningSourceType('admin_adjustment'), false);
  assert.equal(isEarningSourceType('reward_redemption'), false);
  assert.equal(isEarningSourceType('clawback'), false);
  assert.equal(isEarningSourceType(''), false);
  assert.equal(isEarningSourceType(undefined), false);
  assert.equal(isEarningSourceType(null), false);
});

test('rankingPolicy RANKING_DESCRIPTION documents the BR-007 contract', () => {
  assert.match(RANKING_DESCRIPTION, /xp_ledger/);
  assert.match(RANKING_DESCRIPTION, /points_ledger/);
  assert.match(RANKING_DESCRIPTION, /Redemption/i);
});

// ---------------------------------------------------------------------------
// Total XP for current user (uses allowlist via totalXp)
// ---------------------------------------------------------------------------

test('LeaderboardService.getMyRanks returns totalXp sourced from the earn allowlist only', async () => {
  // user-1 has earned XP (check_in + social_share = 200) PLUS an admin_adjustment
  // of +9999 PLUS a future 'clawback' of -500. The allowlist must drop the
  // admin adjustment and ignore the clawback, yielding totalXp = 200.
  const service = createService({
    xpRecords: [
      xpRecord({ userId: 'user-1', sourceType: 'check_in', xpDelta: 100 }),
      xpRecord({ userId: 'user-1', sourceType: 'social_share', xpDelta: 100 }),
      xpRecord({
        userId: 'user-1',
        sourceType: 'admin_adjustment',
        xpDelta: 9999,
        sourceId: 'admin-fix-1',
      }),
      xpRecord({
        userId: 'user-1',
        sourceType: 'clawback',
        xpDelta: -500,
        sourceId: 'clawback-1',
      }),
    ],
  });

  const ranks = await service.getMyRanks({ accessToken: 'token' });

  assert.equal(ranks.currentXp, 200, 'admin_adjustment and clawback must be ignored');
  assert.equal(ranks.city, 'Dhaka');
  assert.equal(ranks.country, 'Bangladesh');
});

// ---------------------------------------------------------------------------
// BR-007 — redemptions must NOT reduce ranking
// ---------------------------------------------------------------------------

test('ranking ignores reward_redemption point debits (BR-007)', async () => {
  // user-1 earns 500 XP via check-in + social_share. They redeem a 100-point
  // reward, which writes a points_ledger debit. ranking must still report
  // 500 XP — the debit lives in a different ledger and cannot affect ranking.
  const service = createService({
    xpRecords: [
      xpRecord({ userId: 'user-1', sourceType: 'check_in', xpDelta: 300 }),
      xpRecord({ userId: 'user-1', sourceType: 'social_share', xpDelta: 200 }),
    ],
    pointRecords: [
      pointsRecord({
        userId: 'user-1',
        sourceType: 'reward_redemption',
        pointsDelta: -100,
        sourceId: 'redemption-1',
      }),
    ],
  });

  const ranks = await service.getMyRanks({ accessToken: 'token' });

  assert.equal(ranks.currentXp, 500, 'ranking XP should equal earned XP only');
  assert.equal(ranks.currentPoints, -100, 'wallet balance reflects the redemption debit');
});

// ---------------------------------------------------------------------------
// periodStart — all three periods (weekly, monthly, all_time)
// ---------------------------------------------------------------------------

test('periodStart("all_time") returns null (no since cutoff)', () => {
  const service = createService();
  assert.equal(service.periodStart('all_time'), null);
});

test('periodStart("monthly") returns the 1st of the current UTC month at 00:00:00.000', () => {
  const service = createService();
  const now = new Date();
  const start = service.periodStart('monthly');
  assert.ok(start instanceof Date);
  assert.equal(start.getUTCFullYear(), now.getUTCFullYear());
  assert.equal(start.getUTCMonth(), now.getUTCMonth());
  assert.equal(start.getUTCDate(), 1);
  assert.equal(start.getUTCHours(), 0);
  assert.equal(start.getUTCMinutes(), 0);
  assert.equal(start.getUTCSeconds(), 0);
  assert.equal(start.getUTCMilliseconds(), 0);
});

test('periodStart("weekly") returns Monday 00:00:00 UTC of the current ISO week', () => {
  // Mirror the production rule with deterministic `now` values.
  const computeWeeklyStart = (now) => {
    const d = new Date(now);
    const day = d.getUTCDay();
    const offset = day === 0 ? 6 : day - 1;
    const start = new Date(d);
    start.setUTCDate(d.getUTCDate() - offset);
    start.setUTCHours(0, 0, 0, 0);
    return start;
  };
  const cases = [
    { now: '2026-07-15T10:30:00.000Z', expected: '2026-07-13T00:00:00.000Z' }, // Wed
    { now: '2026-07-13T00:00:00.000Z', expected: '2026-07-13T00:00:00.000Z' }, // Mon boundary
    { now: '2026-07-19T23:59:59.999Z', expected: '2026-07-13T00:00:00.000Z' }, // Sun (last second)
    { now: '2026-07-20T00:00:00.000Z', expected: '2026-07-20T00:00:00.000Z' }, // next Mon
  ];
  for (const { now, expected } of cases) {
    const start = computeWeeklyStart(now);
    assert.equal(start.toISOString(), expected, `now=${now}`);
    assert.equal(start.getUTCDay(), 1, `must be Monday for now=${now}`);
  }
  // Smoke-test the live prototype method to confirm it returns a Monday at 00:00.
  const live = createService().periodStart('weekly');
  assert.ok(live instanceof Date);
  assert.equal(live.getUTCDay(), 1);
  assert.equal(live.getUTCHours(), 0);
  assert.equal(live.getUTCMinutes(), 0);
  assert.equal(live.getUTCSeconds(), 0);
});

// ---------------------------------------------------------------------------
// All three tie-breakers (using aggregateUserXp directly)
// ---------------------------------------------------------------------------

test('aggregateUserXp applies tie-breaker #1: validCheckins (descending)', async () => {
  // Two users tie on currentXp=500. The one with more check-ins must rank first.
  const service = new LeaderboardService({
    userRepository: new FakeUserRepository([
      makeUser({ uid: 'user-1', fullname: 'Alice' }),
      makeUser({ uid: 'user-2', fullname: 'Bob' }),
    ]),
    identityProvider: new FakeIdentityProvider('user-1'),
    xpRepository: new FakeXpRepository([
      // user-1: 500 XP from 1 check-in + 4 receipts (1 check-in)
      xpRecord({ userId: 'user-1', sourceType: 'check_in', xpDelta: 100 }),
      xpRecord({ userId: 'user-1', sourceType: 'check_in', xpDelta: 100, sourceId: 'c2' }),
      xpRecord({ userId: 'user-1', sourceType: 'receipt_upload', xpDelta: 100, sourceId: 'r1' }),
      xpRecord({ userId: 'user-1', sourceType: 'receipt_upload', xpDelta: 100, sourceId: 'r2' }),
      xpRecord({ userId: 'user-1', sourceType: 'receipt_upload', xpDelta: 100, sourceId: 'r3' }),
      // user-2: 500 XP from 5 receipts only (0 check-ins)
      xpRecord({ userId: 'user-2', sourceType: 'receipt_upload', xpDelta: 100, sourceId: 'r1' }),
      xpRecord({ userId: 'user-2', sourceType: 'receipt_upload', xpDelta: 100, sourceId: 'r2' }),
      xpRecord({ userId: 'user-2', sourceType: 'receipt_upload', xpDelta: 100, sourceId: 'r3' }),
      xpRecord({ userId: 'user-2', sourceType: 'receipt_upload', xpDelta: 100, sourceId: 'r4' }),
      xpRecord({ userId: 'user-2', sourceType: 'receipt_upload', xpDelta: 100, sourceId: 'r5' }),
    ]),
    pointsRepository: new FakePointsRepository([]),
  });

  const rows = await service.aggregateUserXp();
  assert.equal(rows.length, 2);
  assert.equal(rows[0].user.uid, 'user-1', 'more check-ins wins the tie-break');
  assert.equal(rows[1].user.uid, 'user-2');
  assert.equal(rows[0].currentXp, 500);
  assert.equal(rows[1].currentXp, 500);
  assert.equal(rows[0].validCheckins, 2);
  assert.equal(rows[1].validCheckins, 0);
});

test('aggregateUserXp applies tie-breaker #2: firstScoreAt (earliest wins)', async () => {
  // user-1 and user-2 tie on currentXp AND validCheckins. The one who scored
  // first (earliest record) wins.
  const service = new LeaderboardService({
    userRepository: new FakeUserRepository([
      makeUser({ uid: 'user-1', fullname: 'Alice' }),
      makeUser({ uid: 'user-2', fullname: 'Bob' }),
    ]),
    identityProvider: new FakeIdentityProvider('user-1'),
    xpRepository: new FakeXpRepository([
      xpRecord({
        userId: 'user-1',
        sourceType: 'check_in',
        xpDelta: 100,
        createdAt: new Date('2026-06-10T00:00:00.000Z'),
      }),
      xpRecord({
        userId: 'user-1',
        sourceType: 'check_in',
        xpDelta: 100,
        createdAt: new Date('2026-06-15T00:00:00.000Z'),
        sourceId: 'u1-c2',
      }),
      xpRecord({
        userId: 'user-2',
        sourceType: 'check_in',
        xpDelta: 100,
        createdAt: new Date('2026-06-12T00:00:00.000Z'),
        sourceId: 'u2-c1',
      }),
      xpRecord({
        userId: 'user-2',
        sourceType: 'check_in',
        xpDelta: 100,
        createdAt: new Date('2026-06-16T00:00:00.000Z'),
        sourceId: 'u2-c2',
      }),
    ]),
    pointsRepository: new FakePointsRepository([]),
  });

  const rows = await service.aggregateUserXp();
  assert.equal(rows.length, 2);
  assert.equal(rows[0].user.uid, 'user-1', 'earliest firstScoreAt wins');
  assert.equal(rows[1].user.uid, 'user-2');
  assert.equal(rows[0].currentXp, 200);
  assert.equal(rows[1].currentXp, 200);
  assert.equal(rows[0].validCheckins, 2);
  assert.equal(rows[1].validCheckins, 2);
});

test('aggregateUserXp applies tie-breaker #3: latestActivityAt (most recent wins)', async () => {
  // user-1 and user-2 tie on currentXp, validCheckins, AND firstScoreAt. The
  // one with the more recent activity wins.
  const service = new LeaderboardService({
    userRepository: new FakeUserRepository([
      makeUser({ uid: 'user-1', fullname: 'Alice' }),
      makeUser({ uid: 'user-2', fullname: 'Bob' }),
    ]),
    identityProvider: new FakeIdentityProvider('user-1'),
    xpRepository: new FakeXpRepository([
      // Identical firstScoreAt for both: 2026-06-01
      xpRecord({
        userId: 'user-1',
        sourceType: 'check_in',
        xpDelta: 100,
        createdAt: new Date('2026-06-01T00:00:00.000Z'),
      }),
      xpRecord({
        userId: 'user-1',
        sourceType: 'check_in',
        xpDelta: 100,
        createdAt: new Date('2026-06-05T00:00:00.000Z'),
        sourceId: 'u1-c2',
      }),
      xpRecord({
        userId: 'user-2',
        sourceType: 'check_in',
        xpDelta: 100,
        createdAt: new Date('2026-06-01T00:00:00.000Z'),
        sourceId: 'u2-c1',
      }),
      xpRecord({
        userId: 'user-2',
        sourceType: 'check_in',
        xpDelta: 100,
        createdAt: new Date('2026-06-20T00:00:00.000Z'),
        sourceId: 'u2-c2',
      }),
    ]),
    pointsRepository: new FakePointsRepository([]),
  });

  const rows = await service.aggregateUserXp();
  assert.equal(rows.length, 2);
  assert.equal(rows[0].user.uid, 'user-2', 'more recent latestActivityAt wins');
  assert.equal(rows[1].user.uid, 'user-1');
  assert.equal(rows[0].currentXp, 200);
  assert.equal(rows[1].currentXp, 200);
});

test('aggregateUserXp final tie-break is alphabetical by fullname then uid', async () => {
  // user-1 and user-2 fully tied; names differ so alphabetical order wins.
  const service = new LeaderboardService({
    userRepository: new FakeUserRepository([
      makeUser({ uid: 'user-1', fullname: 'Zara' }),
      makeUser({ uid: 'user-2', fullname: 'Alice' }),
    ]),
    identityProvider: new FakeIdentityProvider('user-1'),
    xpRepository: new FakeXpRepository([
      xpRecord({
        userId: 'user-1',
        sourceType: 'check_in',
        xpDelta: 100,
        createdAt: new Date('2026-06-01T00:00:00.000Z'),
      }),
      xpRecord({
        userId: 'user-2',
        sourceType: 'check_in',
        xpDelta: 100,
        createdAt: new Date('2026-06-01T00:00:00.000Z'),
        sourceId: 'u2-c1',
      }),
    ]),
    pointsRepository: new FakePointsRepository([]),
  });

  const rows = await service.aggregateUserXp();
  assert.equal(rows.length, 2);
  assert.equal(rows[0].user.fullname, 'Alice');
  assert.equal(rows[1].user.fullname, 'Zara');
});

// ---------------------------------------------------------------------------
// Allowlist: admin_adjustment excluded
// ---------------------------------------------------------------------------

test('aggregateUserXp excludes admin_adjustment xpDelta entries', async () => {
  // user-1 has 100 earned XP plus a 9999 admin_adjustment and a -100 admin
  // adjustment. Both must be ignored.
  const service = new LeaderboardService({
    userRepository: new FakeUserRepository([
      makeUser({ uid: 'user-1', fullname: 'Alice' }),
    ]),
    identityProvider: new FakeIdentityProvider('user-1'),
    xpRepository: new FakeXpRepository([
      xpRecord({ userId: 'user-1', sourceType: 'check_in', xpDelta: 100 }),
      xpRecord({
        userId: 'user-1',
        sourceType: 'admin_adjustment',
        xpDelta: 9999,
        sourceId: 'admin-up-1',
      }),
      xpRecord({
        userId: 'user-1',
        sourceType: 'admin_adjustment',
        xpDelta: -100,
        sourceId: 'admin-down-1',
      }),
    ]),
    pointsRepository: new FakePointsRepository([]),
  });

  const rows = await service.aggregateUserXp();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].currentXp, 100, 'admin_adjustment must not count');
});

// ---------------------------------------------------------------------------
// Allowlist: forward-compat — unknown sourceType ignored (defense-in-depth)
// ---------------------------------------------------------------------------

test('aggregateUserXp ignores future unknown sourceTypes (defense-in-depth)', async () => {
  // Simulates a future clawback feature that writes negative xpDelta. The
  // ranking must ignore unknown sourceTypes entirely so they cannot reduce a
  // user's score.
  const service = new LeaderboardService({
    userRepository: new FakeUserRepository([
      makeUser({ uid: 'user-1', fullname: 'Alice' }),
    ]),
    identityProvider: new FakeIdentityProvider('user-1'),
    xpRepository: new FakeXpRepository([
      xpRecord({ userId: 'user-1', sourceType: 'check_in', xpDelta: 500 }),
      xpRecord({
        userId: 'user-1',
        sourceType: 'clawback',
        xpDelta: -999,
        sourceId: 'clawback-1',
      }),
      xpRecord({
        userId: 'user-1',
        sourceType: 'refund',
        xpDelta: -50,
        sourceId: 'refund-1',
      }),
    ]),
    pointsRepository: new FakePointsRepository([]),
  });

  const rows = await service.aggregateUserXp();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].currentXp, 500, 'unknown sourceTypes must be ignored, even negative');
});

// ---------------------------------------------------------------------------
// Scope filtering (local, national)
// ---------------------------------------------------------------------------

test('aggregateUserXp with city scope only returns users in that city', async () => {
  const service = new LeaderboardService({
    userRepository: new FakeUserRepository([
      makeUser({ uid: 'user-1', fullname: 'Alice', city: 'Dhaka' }),
      makeUser({ uid: 'user-2', fullname: 'Bob', city: 'Chittagong' }),
    ]),
    identityProvider: new FakeIdentityProvider('user-1'),
    xpRepository: new FakeXpRepository([
      xpRecord({ userId: 'user-1', sourceType: 'check_in', xpDelta: 100 }),
      xpRecord({ userId: 'user-2', sourceType: 'check_in', xpDelta: 200, sourceId: 'u2-c1' }),
    ]),
    pointsRepository: new FakePointsRepository([]),
  });

  const dhakaRows = await service.aggregateUserXp({ city: 'Dhaka' });
  assert.equal(dhakaRows.length, 1);
  assert.equal(dhakaRows[0].user.uid, 'user-1');

  const ctgRows = await service.aggregateUserXp({ city: 'Chittagong' });
  assert.equal(ctgRows.length, 1);
  assert.equal(ctgRows[0].user.uid, 'user-2');
});

test('aggregateUserXp excludes blocked and unverified users', async () => {
  const service = new LeaderboardService({
    userRepository: new FakeUserRepository([
      makeUser({ uid: 'user-1', fullname: 'Active' }),
      makeUser({ uid: 'user-2', fullname: 'Blocked', isBlocked: true }),
      makeUser({ uid: 'user-3', fullname: 'Unverified', isVerified: false }),
    ]),
    identityProvider: new FakeIdentityProvider('user-1'),
    xpRepository: new FakeXpRepository([
      xpRecord({ userId: 'user-1', sourceType: 'check_in', xpDelta: 100 }),
      xpRecord({ userId: 'user-2', sourceType: 'check_in', xpDelta: 9999, sourceId: 'u2-c1' }),
      xpRecord({ userId: 'user-3', sourceType: 'check_in', xpDelta: 5000, sourceId: 'u3-c1' }),
    ]),
    pointsRepository: new FakePointsRepository([]),
  });

  const rows = await service.aggregateUserXp();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].user.uid, 'user-1');
});

// ---------------------------------------------------------------------------
// listLeaderboard pagination + ranks
// ---------------------------------------------------------------------------

test('listLeaderboard returns paginated rows with correct rank numbers', async () => {
  const service = new LeaderboardService({
    userRepository: new FakeUserRepository([
      makeUser({ uid: 'user-1', fullname: 'Alice', city: 'Dhaka', country: 'Bangladesh' }),
      makeUser({ uid: 'user-2', fullname: 'Bob', city: 'Dhaka', country: 'Bangladesh' }),
      makeUser({ uid: 'user-3', fullname: 'Carol', city: 'Dhaka', country: 'Bangladesh' }),
    ]),
    identityProvider: new FakeIdentityProvider('user-1'),
    xpRepository: new FakeXpRepository([
      xpRecord({ userId: 'user-1', sourceType: 'check_in', xpDelta: 100 }),
      xpRecord({ userId: 'user-2', sourceType: 'check_in', xpDelta: 300, sourceId: 'u2-c1' }),
      xpRecord({ userId: 'user-3', sourceType: 'check_in', xpDelta: 200, sourceId: 'u3-c1' }),
    ]),
    pointsRepository: new FakePointsRepository([
      pointsRecord({ userId: 'user-1', sourceType: 'signup_bonus', pointsDelta: 50 }),
    ]),
  });

  const result = await service.listLeaderboard({
    accessToken: 'token',
    page: 1,
    pageSize: 2,
    scope: 'national',
    period: 'all_time',
  });

  assert.equal(result.scope, 'national');
  assert.equal(result.period, 'all_time');
  assert.equal(result.items.length, 2);
  assert.equal(result.items[0].rank, 1);
  assert.equal(result.items[0].userId, 'user-2', 'highest XP first');
  assert.equal(result.items[0].currentXp, 300);
  assert.equal(result.items[1].rank, 2);
  assert.equal(result.items[1].userId, 'user-3');
  assert.equal(result.pagination.totalItems, 3);
  assert.equal(result.pagination.pageSize, 2);
  assert.equal(result.pagination.page, 1);
});
