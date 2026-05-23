import assert from 'node:assert/strict';
import test from 'node:test';

import { NotificationCampaignService } from '../src/modules/notificationCampaigns/notificationCampaignService.js';
import { SupportRequestService } from '../src/modules/supportRequests/supportRequestService.js';
import { UserNotificationService } from '../src/modules/userNotifications/userNotificationService.js';

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
  async listByRole(role) {
    return [...this.users.values()].filter((user) => user.role === role);
  }
}

class FakeSupportRequestRepository {
  constructor(records = []) {
    this.records = new Map(records.map((record) => [record.id, record]));
  }
  async create(record) {
    this.records.set(record.id, record);
    return record;
  }
  async getById(id) {
    return this.records.get(id) ?? null;
  }
  async listAll() {
    return [...this.records.values()];
  }
}

class FakeCampaignRepository {
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

class FakeCheckInRepository {
  constructor(records = []) {
    this.records = records;
  }
  async listByUser(userId) {
    return this.records.filter((record) => record.userId === userId);
  }
}

class FakeSpinRepository {
  constructor(records = []) {
    this.records = records;
  }
  async listByUser(userId) {
    return this.records.filter((record) => record.userId === userId);
  }
}

class FakeRewardRedemptionRepository {
  constructor(records = []) {
    this.records = records;
  }
  async listByUser(userId) {
    return this.records.filter((record) => record.userId === userId);
  }
}

class FakeChallengeParticipationRepository {
  constructor(records = []) {
    this.records = records;
  }
  async listByUser(userId) {
    return this.records.filter((record) => record.userId === userId);
  }
}

class FakeReadRepository {
  constructor(readIds = []) {
    this.readIds = new Set(readIds);
  }
  async listReadNotificationIds() {
    return this.readIds;
  }
  async markRead(record) {
    this.readIds.add(record.notificationId);
    return record;
  }
  async markAllRead(userId, notificationIds) {
    for (const id of notificationIds) {
      this.readIds.add(id);
    }
    return notificationIds.map((notificationId) => ({ userId, notificationId }));
  }
}

class FakeProximityAlertRepository {
  constructor(records = []) {
    this.records = records;
  }
  async listByUser(userId) {
    return this.records.filter((record) => record.userId === userId);
  }
}

class FakePushNotificationService {
  constructor() {
    this.targetingMode = 'external_id';
    this.bulkMessages = [];
  }

  async sendBulk(payload) {
    this.bulkMessages.push(payload);
    return {
      success: true,
      targetCount: payload.recipientIds?.length ?? 0,
      sentCount: payload.recipientIds?.length ?? 0,
    };
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
    age: 24,
    createdAt: new Date('2026-05-01T00:00:00.000Z'),
    ...overrides,
  };
}

test('SupportRequestService creates and lists support requests with FastAPI role rules', async () => {
  const repository = new FakeSupportRequestRepository();
  const service = new SupportRequestService({
    supportRequestRepository: repository,
    userRepository: new FakeUserRepository([makeUser(), makeUser({ uid: 'admin-1', role: 'admin' })]),
    identityProvider: new FakeIdentityProvider(),
  });

  const created = await service.createSupportRequest({
    accessToken: 'user-1',
    payload: { title: 'Need help', message: 'Something went wrong in my app.' },
  });
  assert.equal(created.status, 'open');
  assert.equal(created.createdByUid, 'user-1');

  const listed = await service.listSupportRequests({
    accessToken: 'admin-1',
    page: 1,
    pageSize: 10,
  });
  assert.equal(listed.items.length, 1);

  await assert.rejects(
    service.listSupportRequests({ accessToken: 'user-1', page: 1, pageSize: 10 }),
    (error) => error.code === 'admin_not_found' && error.statusCode === 403,
  );
});

test('NotificationCampaignService enforces schedule/status rules and filtering', async () => {
  const repository = new FakeCampaignRepository();
  const pushNotificationService = new FakePushNotificationService();
  const service = new NotificationCampaignService({
    campaignRepository: repository,
    userRepository: new FakeUserRepository([
      makeUser(),
      makeUser({ uid: 'admin-1', role: 'admin' }),
      makeUser({ uid: 'user-2', city: 'Dhaka', createdAt: new Date('2026-05-20T00:00:00.000Z') }),
    ]),
    identityProvider: new FakeIdentityProvider(),
    pushNotificationService,
  });

  const scheduledAt = new Date(Date.now() + 86_400_000);
  const created = await service.createCampaign({
    accessToken: 'admin-1',
    payload: {
      campaignTitle: 'City Promo',
      campaignBody: 'Promo body',
      campaignCategory: 'promotional',
      targetAudience: 'city',
      cityName: 'Dhaka',
      ageGroup: null,
      deliveryType: 'schedule_later',
      scheduledAt,
      status: null,
      deliveryRate: 25,
    },
  });
  assert.equal(created.status, 'scheduled');

  const listed = await service.listCampaigns({
    accessToken: 'admin-1',
    page: 1,
    pageSize: 10,
    search: 'city',
    statusFilter: 'scheduled',
    campaignCategory: null,
    targetAudience: null,
    deliveryType: null,
    cityName: null,
    ageGroup: null,
    scheduledFrom: null,
    scheduledTo: null,
    minDeliveryRate: null,
    maxDeliveryRate: null,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });
  assert.equal(listed.items.length, 1);

  await assert.rejects(
    service.createCampaign({
      accessToken: 'admin-1',
      payload: {
        campaignTitle: 'Bad',
        campaignBody: 'Invalid schedule',
        campaignCategory: 'promotional',
        targetAudience: 'all_users',
        cityName: null,
        ageGroup: null,
        deliveryType: 'send_now',
        scheduledAt: new Date(),
        status: null,
        deliveryRate: 0,
      },
    }),
    (error) => error.code === 'invalid_campaign_schedule' && error.statusCode === 400,
  );

  const sendNow = await service.createCampaign({
    accessToken: 'admin-1',
    payload: {
      campaignTitle: 'Send Now Promo',
      campaignBody: 'Promo body',
      campaignCategory: 'promotional',
      targetAudience: 'all_users',
      cityName: null,
      ageGroup: null,
      deliveryType: 'send_now',
      scheduledAt: null,
      status: null,
      deliveryRate: 0,
    },
  });
  assert.equal(sendNow.deliveryRate, 100);
  assert.equal(pushNotificationService.bulkMessages.length, 1);
  assert.deepEqual(pushNotificationService.bulkMessages[0].recipientIds.sort(), ['user-1', 'user-2']);
});

test('UserNotificationService aggregates activity, campaign, and read state', async () => {
  const service = new UserNotificationService({
    userRepository: new FakeUserRepository([makeUser()]),
    identityProvider: new FakeIdentityProvider(),
    checkinRepository: new FakeCheckInRepository([
      {
        id: 'check-1',
        userId: 'user-1',
        restaurantName: 'Route Cafe',
        awardedPoints: 20,
        createdAt: new Date('2026-05-10T00:00:00.000Z'),
      },
    ]),
    spinRepository: new FakeSpinRepository([
      {
        id: 'spin-1',
        userId: 'user-1',
        rewardId: 'reward-1',
        rewardTitle: 'Spin Reward',
        rewardDescription: 'Won a spin reward',
        createdAt: new Date('2026-05-10T01:00:00.000Z'),
      },
    ]),
    rewardRedemptionRepository: new FakeRewardRedemptionRepository([
      {
        id: 'redemption-1',
        userId: 'user-1',
        rewardId: 'reward-2',
        rewardTitle: 'Food Reward',
        pointsRequired: 100,
        redeemedAt: new Date('2026-05-10T02:00:00.000Z'),
      },
    ]),
    challengeParticipationRepository: new FakeChallengeParticipationRepository([
      {
        id: 'challenge-1',
        userId: 'user-1',
        challengeId: 'challenge-main',
        challengeTitle: '5 Check-ins',
        rewardPoints: 200,
        status: 'completed',
        startedAt: new Date('2026-05-09T00:00:00.000Z'),
        completedAt: new Date('2026-05-10T03:00:00.000Z'),
      },
    ]),
    notificationCampaignRepository: new FakeCampaignRepository([
      {
        id: 'campaign-1',
        campaignTitle: 'Reward Promo',
        campaignBody: 'Special reward offer',
        campaignCategory: 'reward',
        targetAudience: 'city',
        cityName: 'Dhaka',
        ageGroup: null,
        deliveryType: 'send_now',
        scheduledAt: null,
        sentAt: new Date('2026-05-10T04:00:00.000Z'),
        status: 'active',
        deliveryRate: 80,
        createdBy: 'admin-1',
        createdAt: new Date('2026-05-10T04:00:00.000Z'),
        updatedAt: new Date('2026-05-10T04:00:00.000Z'),
      },
    ]),
    readRepository: new FakeReadRepository(['checkin:check-1']),
    proximityAlertRepository: new FakeProximityAlertRepository([
      {
        id: 'prox-1',
        userId: 'user-1',
        restaurantId: 'restaurant-1',
        restaurantName: 'Nearby Place',
        distanceKm: 0.8,
        mapsUrl: 'https://maps.example.com',
        createdAt: new Date('2026-05-10T05:00:00.000Z'),
      },
    ]),
  });

  const listed = await service.listNotifications({
    accessToken: 'user-1',
    page: 1,
    pageSize: 10,
    category: null,
  });
  assert.equal(listed.items.length, 6);
  assert.equal(listed.unreadCount, 5);
  assert.equal(listed.items[0].type, 'proximity_alert');

  const preview = await service.getPreview({ accessToken: 'user-1', limit: 2 });
  assert.equal(preview.items.length, 2);

  await service.markRead({ accessToken: 'user-1', notificationId: 'campaign:campaign-1' });
  const unread = await service.getUnreadCount({ accessToken: 'user-1' });
  assert.equal(unread.count, 4);
});
