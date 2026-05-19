import assert from 'node:assert/strict';
import test from 'node:test';

import { LeaderboardService } from '../src/modules/leaderboard/leaderboardService.js';
import { UserService } from '../src/modules/users/userService.js';
import { XpService } from '../src/modules/xp/xpService.js';

class FakeUserRepository {
  constructor(users = []) {
    this.users = new Map(users.map((user) => [user.uid, user]));
  }

  async getByUid(uid) {
    return this.users.get(uid) ?? null;
  }

  async updateFields(uid, fields) {
    const user = this.users.get(uid);
    if (!user) return null;
    Object.assign(user, {
      fullname: fields.fullname ?? user.fullname,
      city: fields.city ?? user.city,
      country: fields.country ?? user.country,
      profileImageUrl: fields.profile_image_url ?? user.profileImageUrl,
      proximityDistanceKm: fields.proximity_distance_km ?? user.proximityDistanceKm,
      lastKnownLatitude: fields.last_known_latitude ?? user.lastKnownLatitude,
      lastKnownLongitude: fields.last_known_longitude ?? user.lastKnownLongitude,
      proximityAlertsEnabled: fields.proximity_alerts_enabled ?? user.proximityAlertsEnabled,
      pushNotificationToken: fields.push_notification_token ?? user.pushNotificationToken,
      pushNotificationPlatform: fields.push_notification_platform ?? user.pushNotificationPlatform,
    });
    return user;
  }

  async listByReferredByUid(uid) {
    return [...this.users.values()].filter((user) => user.referredByUid === uid);
  }

  async countVerifiedReferrals(uid) {
    return (await this.listByReferredByUid(uid)).filter((user) => user.isVerified).length;
  }

  async listByRole(role) {
    return [...this.users.values()].filter((user) => user.role === role);
  }
}

class FakeIdentityProvider {
  async verifyIdToken() {
    return { uid: 'user-1', email: 'user@example.com' };
  }
}

class FakeLoginEventRepository {
  async listByUser() {
    return [{ id: 'login-1', userId: 'user-1', createdAt: new Date() }];
  }

  async countCurrentStreak() {
    return 1;
  }
}

class FakeCheckInRepository {
  constructor(records = []) {
    this.records = records;
  }

  async countByUser(userId) {
    return this.records.filter((record) => record.userId === userId).length;
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

  async create(record) {
    this.records.push(record);
    return record;
  }
}

class FakeImageStorage {
  async uploadImage({ folder, file }) {
    return { publicUrl: `https://cdn.example.com/${folder}/${file.originalname}` };
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

function createService({ user = makeUser(), xpRecords = [], pointRecords = [] } = {}) {
  const userRepository = new FakeUserRepository([
    user,
    makeUser({
      uid: 'user-2',
      email: 'two@example.com',
      fullname: 'Alice Smith',
      referralCode: 'REF22222',
      referredByUid: user.uid,
    }),
  ]);
  const identityProvider = new FakeIdentityProvider();
  const xpRepository = new FakeXpRepository(xpRecords);
  const xpService = new XpService({
    xpRepository,
    pointsRepository: new FakePointsRepository(pointRecords),
  });
  const leaderboardService = new LeaderboardService({
    userRepository,
    identityProvider,
    xpRepository,
  });
  return new UserService({
    userRepository,
    loginEventRepository: new FakeLoginEventRepository(),
    identityProvider,
    xpService,
    checkinRepository: new FakeCheckInRepository([
      { id: 'check-1', userId: user.uid },
      { id: 'check-2', userId: user.uid },
    ]),
    imageStorage: new FakeImageStorage(),
    leaderboardService,
  });
}

test('UserService getMe returns FastAPI-compatible profile fields', async () => {
  const service = createService();

  const result = await service.getMe({ accessToken: 'token' });

  assert.equal(result.uid, 'user-1');
  assert.equal(result.profileImageUrl, null);
  assert.equal(result.isVerified, true);
  assert.equal(result.isBlocked, false);
});

test('UserService updates profile fields', async () => {
  const service = createService();

  const result = await service.updateProfile({
    accessToken: 'token',
    payload: { fullname: 'Jane Updated', city: 'Chittagong' },
  });

  assert.equal(result.fullname, 'Jane Updated');
  assert.equal(result.city, 'Chittagong');
});

test('UserService summaries include xp, points, rank, and streak', async () => {
  const service = createService({
    xpRecords: [
      {
        id: 'xp-1',
        userId: 'user-1',
        sourceType: 'check_in',
        sourceId: 'check-1',
        xpDelta: 350,
        createdAt: new Date(),
      },
    ],
    pointRecords: [
      {
        id: 'points-1',
        userId: 'user-1',
        sourceType: 'check_in',
        sourceId: 'check-1',
        pointsDelta: 100,
        createdAt: new Date(),
      },
    ],
  });

  const result = await service.getSummary({ accessToken: 'token' });

  assert.equal(result.xpSummary.currentXp, 350);
  assert.equal(result.xpSummary.currentLevelName, 'Pathfinder');
  assert.equal(result.pointsSummary.currentPoints, 100);
  assert.equal(result.rank.currentXp, 350);
  assert.equal(result.streak.currentStreak, 1);
  assert.equal(result.totalCheckInCount, 2);
});

test('UserService uploads profile image', async () => {
  const service = createService();

  const result = await service.uploadProfileImage({
    accessToken: 'token',
    image: { originalname: 'profile.png', mimetype: 'image/png', buffer: Buffer.from('ok') },
  });

  assert.equal(result.profileImageUrl, 'https://cdn.example.com/user_profiles/user-1/profile.png');
});
