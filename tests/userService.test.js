import assert from 'node:assert/strict';
import test from 'node:test';

import { ApplicationError } from '../src/core/ApplicationError.js';
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

  async getById(checkinId) {
    return this.records.find((record) => record.id === checkinId) ?? null;
  }

  async getRecentByUser(userId) {
    const records = this.records.filter((record) => record.userId === userId);
    if (!records.length) return null;
    return records.reduce((latest, record) =>
      new Date(latest.createdAt ?? 0) >= new Date(record.createdAt ?? 0) ? latest : record,
    );
  }

  async countByUser(userId) {
    return this.records.filter((record) => record.userId === userId).length;
  }
}

class FakeRewardRedemptionRepository {
  constructor(records = []) {
    this.records = records;
  }

  async getById(redemptionId) {
    return this.records.find((record) => record.id === redemptionId) ?? null;
  }

  async listByUser(userId) {
    return this.records.filter((record) => record.userId === userId);
  }
}

class FakeReceiptUploadRepository {
  constructor(records = []) {
    this.records = records;
  }

  async getById(receiptUploadId) {
    return this.records.find((record) => record.id === receiptUploadId) ?? null;
  }

  async listByUser(userId) {
    return this.records
      .filter((record) => record.userId === userId)
      .sort((left, right) => new Date(right.createdAt ?? 0) - new Date(left.createdAt ?? 0));
  }
}

class FakeRestaurantRepository {
  constructor(records = []) {
    this.records = new Map(records.map((record) => [record.id, record]));
  }

  async getById(restaurantId) {
    return this.records.get(restaurantId) ?? null;
  }
}

class FakeXpRepository {
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

function createService({
  user = makeUser(),
  xpRecords = [],
  pointRecords = [],
  checkinRecords = null,
  rewardRedemptionRecords = [],
  receiptUploadRecords = [],
  restaurantRecords = [
    { id: 'restaurant-1', name: 'Cafe One', imageUrl: 'https://cdn.example.com/cafe-one.png' },
  ],
} = {}) {
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
  const pointsRepository = new FakePointsRepository(pointRecords);
  const xpService = new XpService({
    xpRepository,
    pointsRepository,
  });
  const leaderboardService = new LeaderboardService({
    userRepository,
    identityProvider,
    xpRepository,
    pointsRepository,
  });
  return new UserService({
    userRepository,
    loginEventRepository: new FakeLoginEventRepository(),
    identityProvider,
    xpService,
    checkinRepository: new FakeCheckInRepository(
      checkinRecords ?? [
        { id: 'check-1', userId: user.uid },
        { id: 'check-2', userId: user.uid },
      ],
    ),
    rewardRedemptionRepository: new FakeRewardRedemptionRepository(rewardRedemptionRecords),
    receiptUploadRepository: new FakeReceiptUploadRepository(receiptUploadRecords),
    restaurantRepository: new FakeRestaurantRepository(restaurantRecords),
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

test('UserService claimSocialShareReward awards 50 points once for check-in shares', async () => {
  const xpRecords = [];
  const service = createService({
    checkinRecords: [{ id: 'check-1', userId: 'user-1' }],
    xpRecords,
  });

  const first = await service.claimSocialShareReward({
    accessToken: 'token',
    payload: { shareType: 'checkin', entityId: 'check-1', platform: 'instagram' },
  });
  const duplicate = await service.claimSocialShareReward({
    accessToken: 'token',
    payload: { shareType: 'checkin', entityId: 'check-1', platform: 'instagram' },
  });

  assert.equal(first.awarded, true);
  assert.equal(first.shareType, 'checkin');
  assert.equal(first.entityId, 'check-1');
  assert.equal(first.pointsDelta, 50);
  assert.equal(first.currentPoints, 50);
  assert.equal(duplicate.awarded, false);
  assert.equal(duplicate.pointsDelta, 0);
  assert.equal(duplicate.currentPoints, 50);
  assert.equal(xpRecords.length, 1);
  assert.equal(xpRecords[0].sourceType, 'social_share');
});

test('UserService claimSocialShareReward awards 100 points for reward shares', async () => {
  const xpRecords = [];
  const service = createService({
    rewardRedemptionRecords: [{ id: 'redemption-1', userId: 'user-1' }],
    xpRecords,
  });

  const result = await service.claimSocialShareReward({
    accessToken: 'token',
    payload: { shareType: 'reward', entityId: 'redemption-1', platform: 'facebook' },
  });

  assert.equal(result.awarded, true);
  assert.equal(result.shareType, 'reward');
  assert.equal(result.entityId, 'redemption-1');
  assert.equal(result.pointsDelta, 100);
  assert.equal(result.currentPoints, 100);
  assert.equal(xpRecords[0].xpDelta, 100);
});

test('UserService claimSocialShareReward awards 50 points for receipt shares', async () => {
  const service = createService({
    receiptUploadRecords: [
      {
        id: 'receipt-1',
        userId: 'user-1',
        restaurantId: 'restaurant-1',
        restaurantName: 'Cafe One',
        receiptImageUrl: 'https://cdn.example.com/receipt.png',
        awardedPoints: 40,
        createdAt: new Date('2026-06-16T10:00:00.000Z'),
      },
    ],
  });

  const result = await service.claimSocialShareReward({
    accessToken: 'token',
    payload: { shareType: 'receipt', entityId: 'receipt-1', platform: 'instagram' },
  });

  assert.equal(result.awarded, true);
  assert.equal(result.shareType, 'receipt');
  assert.equal(result.entityId, 'receipt-1');
  assert.equal(result.pointsDelta, 50);
  assert.equal(result.currentPoints, 50);
});

test('UserService claimSocialShareReward rejects sharing another user check-in', async () => {
  const service = createService({
    checkinRecords: [{ id: 'check-foreign', userId: 'user-2' }],
  });

  await assert.rejects(
    () =>
      service.claimSocialShareReward({
        accessToken: 'token',
        payload: { shareType: 'checkin', entityId: 'check-foreign', platform: 'instagram' },
      }),
    (error) =>
      error instanceof ApplicationError &&
      error.code === 'checkin_not_found' &&
      error.statusCode === 404,
  );
});

test('UserService claimSocialShareReward uses most recent check-in when entityId is omitted', async () => {
  const service = createService({
    checkinRecords: [
      { id: 'check-1', userId: 'user-1', createdAt: new Date('2026-06-16T08:00:00.000Z') },
      { id: 'check-2', userId: 'user-1', createdAt: new Date('2026-06-16T09:00:00.000Z') },
    ],
  });

  const result = await service.claimSocialShareReward({
    accessToken: 'token',
    payload: { shareType: 'checkin', platform: 'instagram' },
  });

  assert.equal(result.awarded, true);
  assert.equal(result.shareType, 'checkin');
  assert.equal(result.entityId, 'check-2');
  assert.equal(result.pointsDelta, 50);
});

test('UserService claimSocialShareReward uses most recent reward redemption when entityId is omitted', async () => {
  const service = createService({
    rewardRedemptionRecords: [
      { id: 'redemption-1', userId: 'user-1', redeemedAt: new Date('2026-06-16T08:00:00.000Z') },
      { id: 'redemption-2', userId: 'user-1', redeemedAt: new Date('2026-06-16T09:00:00.000Z') },
    ],
  });

  const result = await service.claimSocialShareReward({
    accessToken: 'token',
    payload: { shareType: 'reward', platform: 'facebook' },
  });

  assert.equal(result.awarded, true);
  assert.equal(result.shareType, 'reward');
  assert.equal(result.entityId, 'redemption-2');
  assert.equal(result.pointsDelta, 100);
});

test('UserService getCheckinSharePreview returns share-ready content for an owned check-in', async () => {
  const service = createService({
    checkinRecords: [
      {
        id: 'check-1',
        userId: 'user-1',
        restaurantId: 'restaurant-1',
        restaurantName: 'Cafe One',
        awardedPoints: 25,
        createdAt: new Date('2026-06-16T08:00:00.000Z'),
      },
    ],
  });

  const result = await service.getCheckinSharePreview({
    accessToken: 'token',
    checkinId: 'check-1',
  });

  assert.equal(result.shareType, 'checkin');
  assert.equal(result.entityId, 'check-1');
  assert.equal(result.restaurantName, 'Cafe One');
  assert.equal(result.pointsReward, 50);
  assert.equal(result.imageUrl, 'https://cdn.example.com/cafe-one.png');
  assert.match(result.title, /checked in at Cafe One/);
});

test('UserService getRewardSharePreview returns share-ready content for an owned reward redemption', async () => {
  const service = createService({
    rewardRedemptionRecords: [
      {
        id: 'redemption-1',
        userId: 'user-1',
        rewardId: 'reward-1',
        rewardTitle: 'Free Burger',
        rewardImageUrl: 'https://cdn.example.com/reward.png',
        rewardCategory: 'general_rewards',
        pointsRequired: 100,
        redeemedAt: new Date('2026-06-16T09:00:00.000Z'),
      },
    ],
  });

  const result = await service.getRewardSharePreview({
    accessToken: 'token',
    redemptionId: 'redemption-1',
  });

  assert.equal(result.shareType, 'reward');
  assert.equal(result.entityId, 'redemption-1');
  assert.equal(result.rewardTitle, 'Free Burger');
  assert.equal(result.pointsReward, 100);
  assert.equal(result.imageUrl, 'https://cdn.example.com/reward.png');
  assert.match(result.text, /Free Burger/);
});

test('UserService getReceiptSharePreview returns share-ready content for an owned receipt upload', async () => {
  const service = createService({
    receiptUploadRecords: [
      {
        id: 'receipt-1',
        userId: 'user-1',
        restaurantId: 'restaurant-1',
        restaurantName: 'Cafe One',
        receiptImageUrl: 'https://cdn.example.com/receipt.png',
        awardedPoints: 40,
        createdAt: new Date('2026-06-16T10:00:00.000Z'),
      },
    ],
  });

  const result = await service.getReceiptSharePreview({
    accessToken: 'token',
    receiptUploadId: 'receipt-1',
  });

  assert.equal(result.shareType, 'receipt');
  assert.equal(result.entityId, 'receipt-1');
  assert.equal(result.restaurantName, 'Cafe One');
  assert.equal(result.pointsReward, 50);
  assert.equal(result.imageUrl, 'https://cdn.example.com/receipt.png');
});
