import { getAuthenticatedAccount, requireActiveRoles } from '../../shared/auth/authorization.js';
import { buildPaginationMeta } from '../../shared/pagination.js';

export class UserNotificationService {
  constructor({
    userRepository,
    identityProvider,
    checkinRepository,
    spinRepository,
    rewardRedemptionRepository,
    challengeParticipationRepository,
    notificationCampaignRepository,
    readRepository,
    proximityAlertRepository = null,
  }) {
    this.userRepository = userRepository;
    this.identityProvider = identityProvider;
    this.checkinRepository = checkinRepository;
    this.spinRepository = spinRepository;
    this.rewardRedemptionRepository = rewardRedemptionRepository;
    this.challengeParticipationRepository = challengeParticipationRepository;
    this.notificationCampaignRepository = notificationCampaignRepository;
    this.readRepository = readRepository;
    this.proximityAlertRepository = proximityAlertRepository;
  }

  async listNotifications({ accessToken, page, pageSize, category = null }) {
    const user = await this.getCurrentUser(accessToken);
    let records = await this.buildNotifications(user.uid);
    if (category && category !== 'all') {
      records = records.filter((record) => record.category === category);
    }
    const totalItems = records.length;
    const start = (page - 1) * pageSize;
    return {
      items: records.slice(start, start + pageSize),
      pagination: buildPaginationMeta({ page, pageSize, totalItems }),
      unreadCount: records.filter((record) => !record.isRead).length,
    };
  }

  async getPreview({ accessToken, limit = 4 }) {
    const user = await this.getCurrentUser(accessToken);
    const records = await this.buildNotifications(user.uid);
    return {
      items: records.slice(0, limit),
      unreadCount: records.filter((record) => !record.isRead).length,
    };
  }

  async getUnreadCount({ accessToken }) {
    const user = await this.getCurrentUser(accessToken);
    const records = await this.buildNotifications(user.uid);
    return {
      count: records.filter((record) => !record.isRead).length,
    };
  }

  async markRead({ accessToken, notificationId }) {
    const user = await this.getCurrentUser(accessToken);
    const now = new Date();
    await this.readRepository.markRead({
      id: `${user.uid}:${notificationId}`,
      userId: user.uid,
      notificationId,
      readAt: now,
      createdAt: now,
      updatedAt: now,
    });
  }

  async markAllRead({ accessToken }) {
    const user = await this.getCurrentUser(accessToken);
    const records = await this.buildNotifications(user.uid);
    const unreadIds = records.filter((record) => !record.isRead).map((record) => record.id);
    if (unreadIds.length > 0) {
      await this.readRepository.markAllRead(user.uid, unreadIds);
    }
  }

  async buildNotifications(userId) {
    const readIds = await this.readRepository.listReadNotificationIds(userId);
    const user = await this.userRepository.getByUid(userId);
    if (!user) {
      return [];
    }

    const items = [];
    items.push(...(await this.fromCheckins(user.uid, readIds)));
    items.push(...(await this.fromSpins(user.uid, readIds)));
    items.push(...(await this.fromRewardRedemptions(user.uid, readIds)));
    items.push(...(await this.fromChallengeParticipations(user.uid, readIds)));
    items.push(...(await this.fromProximityAlerts(user.uid, readIds)));
    items.push(...(await this.fromCampaigns(user, readIds)));
    items.sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
    return items;
  }

  async fromCheckins(userId, readIds) {
    const records = await this.checkinRepository.listByUser(userId);
    return records.map((record) => ({
      id: `checkin:${record.id}`,
      type: 'check_in',
      category: 'points',
      title: 'New Points Earned',
      body: `You just earned ${record.awardedPoints} points from your last order at ${record.restaurantName}.`,
      sourceId: record.id,
      targetType: 'check_in',
      targetId: record.id,
      pointsDelta: record.awardedPoints,
      createdAt: record.createdAt,
      isRead: readIds.has(`checkin:${record.id}`),
    }));
  }

  async fromSpins(userId, readIds) {
    const records = await this.spinRepository.listByUser(userId);
    return records.map((record) => ({
      id: `spin:${record.id}`,
      type: 'spin',
      category: 'rewards',
      title: record.rewardTitle,
      body: record.rewardDescription,
      sourceId: record.id,
      targetType: 'spin',
      targetId: record.rewardId,
      createdAt: record.createdAt ?? record.spunAt,
      isRead: readIds.has(`spin:${record.id}`),
    }));
  }

  async fromRewardRedemptions(userId, readIds) {
    const records = await this.rewardRedemptionRepository.listByUser(userId);
    return records.map((record) => ({
      id: `reward-redemption:${record.id}`,
      type: 'reward_redemption',
      category: 'rewards',
      title: 'Reward Claimed',
      body: `You redeemed ${record.rewardTitle} for ${record.pointsRequired} points.`,
      sourceId: record.id,
      targetType: 'reward_redemption',
      targetId: record.rewardId,
      createdAt: record.redeemedAt,
      isRead: readIds.has(`reward-redemption:${record.id}`),
    }));
  }

  async fromChallengeParticipations(userId, readIds) {
    const records = await this.challengeParticipationRepository.listByUser(userId);
    return records.map((record) => {
      const completed = record.status === 'completed';
      const notificationId = `challenge:${record.id}`;
      return {
        id: notificationId,
        type: completed ? 'challenge_completed' : 'challenge_started',
        category: 'challenges',
        title: completed ? 'Challenge Completed' : 'Challenge Started',
        body: completed
          ? `You completed ${record.challengeTitle} and earned ${record.rewardPoints} points.`
          : `You started ${record.challengeTitle}. Keep going to earn ${record.rewardPoints} points.`,
        sourceId: record.id,
        targetType: 'challenge_participation',
        targetId: record.challengeId,
        createdAt: record.completedAt ?? record.startedAt,
        isRead: readIds.has(notificationId),
      };
    });
  }

  async fromCampaigns(user, readIds) {
    const records = await this.notificationCampaignRepository.listAll();
    return records
      .filter((record) => this.campaignTargetsUser(record, user))
      .filter((record) => record.status === 'active' || record.status === 'completed')
      .map((record) => ({
        id: `campaign:${record.id}`,
        type: 'campaign',
        category: ['rewards', 'challenges', 'nearby', 'general'].includes(record.campaignCategory)
          ? record.campaignCategory
          : 'promotions',
        title: record.campaignTitle,
        body: record.campaignBody,
        sourceId: record.id,
        targetType: 'notification_campaign',
        targetId: record.id,
        createdAt: record.sentAt ?? record.createdAt,
        isRead: readIds.has(`campaign:${record.id}`),
      }));
  }

  async fromProximityAlerts(userId, readIds) {
    if (!this.proximityAlertRepository) {
      return [];
    }
    const records = await this.proximityAlertRepository.listByUser(userId);
    return records.map((record) => ({
      id: `proximity:${record.id}`,
      type: 'proximity_alert',
      category: 'nearby',
      title: `${record.restaurantName} is nearby`,
      body: `${record.restaurantName} is ${record.distanceKm.toFixed(1)} km away. Tap to open directions.`,
      sourceId: record.id,
      targetType: 'restaurant',
      targetId: record.restaurantId,
      targetUrl: record.mapsUrl,
      createdAt: record.createdAt,
      isRead: readIds.has(`proximity:${record.id}`),
    }));
  }

  campaignTargetsUser(record, user) {
    const audience = record.targetAudience;
    if (audience === 'all_users' || audience === 'global') {
      return true;
    }
    if (audience === 'city') {
      return Boolean(user.city && record.cityName && user.city.trim().toLowerCase() === record.cityName.trim().toLowerCase());
    }
    if (audience === 'age_group') {
      return Boolean(user.age !== null && user.age !== undefined && record.ageGroup && this.ageGroupMatches(user.age, record.ageGroup));
    }
    if (audience === 'new_user') {
      return Date.now() - user.createdAt.getTime() <= 14 * 24 * 60 * 60 * 1000;
    }
    return false;
  }

  ageGroupMatches(age, ageGroup) {
    const normalized = ageGroup.trim().toLowerCase().replace(/\s+/g, '');
    if (normalized === '18+' || normalized === '18plus') return age >= 18;
    if (normalized === '13-17' || normalized === 'teen') return age >= 13 && age <= 17;
    if (normalized === '18-24' || normalized === '18to24') return age >= 18 && age <= 24;
    if (normalized === '25-34' || normalized === '25to34') return age >= 25 && age <= 34;
    if (normalized === '35-44' || normalized === '35to44') return age >= 35 && age <= 44;
    if (normalized === '45+' || normalized === '45plus') return age >= 45;
    return String(age) === normalized;
  }

  async getCurrentUser(accessToken) {
    const user = await getAuthenticatedAccount({
      accessToken,
      identityProvider: this.identityProvider,
      userRepository: this.userRepository,
      notFoundCode: 'user_not_found',
      notFoundMessage: 'No end-user account found for the provided credentials.',
      notFoundStatusCode: 404,
    });
    return requireActiveRoles({
      record: user,
      allowedRoles: new Set(['user']),
      roleErrorCode: 'user_not_found',
      roleErrorMessage: 'No end-user account found for the provided credentials.',
      roleErrorStatusCode: 404,
      blockedErrorCode: 'user_blocked',
      blockedErrorMessage: 'The user account is blocked.',
    });
  }
}
