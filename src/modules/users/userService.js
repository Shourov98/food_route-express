import { ApplicationError } from '../../core/ApplicationError.js';
import { getAuthenticatedAccount, requireActiveRoles } from '../../shared/auth/authorization.js';
import { buildProximityAlertRecordId } from '../proximityAlerts/proximityAlertRepository.js';

const DEFAULT_PROXIMITY_DISTANCE_KM = 0.3;

function profileData(user) {
  return {
    uid: user.uid,
    fullname: user.fullname,
    email: user.email,
    gender: user.gender,
    age: user.age,
    dateOfBirth: user.dateOfBirth ?? null,
    city: user.city,
    country: user.country,
    profileImageUrl: user.profileImageUrl,
    referralCode: user.referralCode,
    role: user.role,
    isVerified: user.isVerified,
    isBlocked: user.isBlocked,
  };
}

function proximitySettingsData(user) {
  const distanceKm =
    user.proximityDistanceKm === null || user.proximityDistanceKm === undefined
      ? DEFAULT_PROXIMITY_DISTANCE_KM
      : user.proximityDistanceKm;

  return {
    enabled: user.proximityAlertsEnabled,
    distanceInMeter: Math.round(distanceKm * 1000),
  };
}

export class UserService {
  constructor({
    userRepository,
    loginEventRepository,
    identityProvider,
    xpService,
    leaderboardService,
    checkinRepository,
    rewardRedemptionRepository = null,
    receiptUploadRepository = null,
    imageStorage,
    restaurantRepository = null,
    proximityAlertRepository = null,
    proximityAlertLogRepository = null,
    pushNotificationService = null,
    proximityAlertCooldownMinutes = 1440,
  }) {
    this.userRepository = userRepository;
    this.loginEventRepository = loginEventRepository;
    this.identityProvider = identityProvider;
    this.xpService = xpService;
    this.leaderboardService = leaderboardService;
    this.checkinRepository = checkinRepository;
    this.rewardRedemptionRepository = rewardRedemptionRepository;
    this.receiptUploadRepository = receiptUploadRepository;
    this.imageStorage = imageStorage;
    this.restaurantRepository = restaurantRepository;
    this.proximityAlertRepository = proximityAlertRepository;
    this.proximityAlertLogRepository = proximityAlertLogRepository;
    this.pushNotificationService = pushNotificationService;
    this.proximityAlertCooldownMinutes = proximityAlertCooldownMinutes;
  }

  async getMe({ accessToken }) {
    return profileData(await this.getCurrentUser(accessToken));
  }

  async updateProfile({ accessToken, payload }) {
    const user = await this.getCurrentUser(accessToken);
    const fields = {};
    if (payload.fullname !== undefined) fields.fullname = payload.fullname;
    if (payload.city !== undefined) fields.city = payload.city;
    if (payload.country !== undefined) fields.country = payload.country;
    if (Object.keys(fields).length === 0) {
      return profileData(user);
    }
    const updated = await this.userRepository.updateFields(user.uid, fields);
    if (!updated) {
      throw new ApplicationError({
        code: 'user_not_found',
        message: 'No end-user account found for the provided credentials.',
        statusCode: 404,
      });
    }
    return profileData(updated);
  }

  async getReferralSummary({ accessToken }) {
    const user = await this.getCurrentUser(accessToken);
    const referredUsers = (await this.userRepository.listByReferredByUid(user.uid)).filter(
      (referredUser) => referredUser.isVerified,
    );
    return {
      referralCode: user.referralCode ?? '',
      referredByUid: user.referredByUid,
      verifiedReferralCount: await this.userRepository.countVerifiedReferrals(user.uid),
      referralMilestoneAwarded: user.referralBonusAwarded,
      referredUsers: referredUsers.map((referredUser) => ({
        profile: profileData(referredUser),
        registeredAt: referredUser.createdAt,
      })),
    };
  }

  async getXpSummary({ accessToken }) {
    const user = await this.getCurrentUser(accessToken);
    return this.xpService.getSummary({ userId: user.uid });
  }

  async getPointsSummary({ accessToken }) {
    const user = await this.getCurrentUser(accessToken);
    return this.xpService.getPointsSummary({ userId: user.uid });
  }

  async getProximitySettings({ accessToken }) {
    const user = await this.getCurrentUser(accessToken);
    return proximitySettingsData(user);
  }

  async updateProximitySettings({ accessToken, payload }) {
    const user = await this.getCurrentUser(accessToken);
    const fields = {};
    if (payload.distanceInMeter !== undefined) {
      fields.proximity_distance_km = payload.distanceInMeter / 1000;
      if (payload.enabled === undefined) fields.proximity_alerts_enabled = true;
    }
    if (payload.enabled !== undefined) fields.proximity_alerts_enabled = payload.enabled;
    const updated = Object.keys(fields).length ? await this.userRepository.updateFields(user.uid, fields) : user;
    if (!updated) {
      throw new ApplicationError({
        code: 'user_not_found',
        message: 'No end-user account found for the provided credentials.',
        statusCode: 404,
      });
    }
    return {
      settings: proximitySettingsData(updated),
      triggeredAlerts: [],
    };
  }

  async scanProximityAlerts({ accessToken, payload }) {
    const user = await this.getCurrentUser(accessToken);
    const updatedUser = await this.userRepository.updateFields(user.uid, {
      last_known_latitude: payload.latitude,
      last_known_longitude: payload.longitude,
    });
    const { triggeredAlerts } = await this.scanProximityRecord(user, {
      latitude: payload.latitude,
      longitude: payload.longitude,
    });
    return {
      settings: proximitySettingsData(updatedUser ?? user),
      triggeredAlerts,
    };
  }

  async reportProximityLocation({ accessToken, payload }) {
    return this.scanProximityAlerts({ accessToken, payload });
  }

  async scanAllProximityAlerts() {
    const users = (await this.userRepository.listByRole('user')).filter(
      (user) => user.isVerified && !user.isBlocked,
    );
    let processedUsers = 0;
    let createdAlerts = 0;
    let pushedAlerts = 0;
    for (const user of users) {
      processedUsers += 1;
      const result = await this.scanProximityRecord(user);
      createdAlerts += result.createdCount;
      pushedAlerts += result.pushedCount;
    }
    return {
      processedUsers,
      createdAlerts,
      pushedAlerts,
    };
  }

  async registerPushToken({ accessToken, payload }) {
    const user = await this.getCurrentUser(accessToken);
    const updated = await this.userRepository.updateFields(user.uid, {
      push_notification_token: payload.pushToken,
      push_notification_platform: payload.platform,
      push_notification_provider: payload.provider ?? null,
      push_notification_token_updated_at: new Date(),
    });
    if (!updated) {
      throw new ApplicationError({
        code: 'user_not_found',
        message: 'No end-user account found for the provided credentials.',
        statusCode: 404,
      });
    }
    return { pushTokenRegistered: true };
  }

  async claimSocialShareReward({ accessToken, payload }) {
    const user = await this.getCurrentUser(accessToken);
    const entityId = await this.resolveSocialShareEntityId({
      userId: user.uid,
      shareType: payload.shareType,
      entityId: payload.entityId,
    });
    const pointsDelta = await this.resolveSocialSharePoints({
      userId: user.uid,
      shareType: payload.shareType,
      entityId,
    });
    const shareId = `${payload.shareType}:${entityId}`;
    const record = await this.xpService.awardPoints({
      userId: user.uid,
      delta: pointsDelta,
      sourceType: 'social_share',
      sourceId: shareId,
      city: user.city ?? '',
      country: user.country ?? '',
    });
    if (record) {
      await this.xpService.awardXp({
        userId: user.uid,
        delta: pointsDelta,
        sourceType: 'social_share',
        sourceId: shareId,
        city: user.city ?? '',
        country: user.country ?? '',
      });
    }
    const currentPoints = await this.xpService.getTotalPoints(user.uid);
    return {
      awarded: Boolean(record),
      shareType: payload.shareType,
      entityId,
      pointsDelta: record ? pointsDelta : 0,
      currentPoints,
    };
  }

  async getCheckinSharePreview({ accessToken, checkinId }) {
    const user = await this.getCurrentUser(accessToken);
    const checkin = await this.requireOwnedCheckin({ userId: user.uid, checkinId });
    const restaurant = this.restaurantRepository
      ? await this.restaurantRepository.getById(checkin.restaurantId)
      : null;
    return {
      shareType: 'checkin',
      entityId: checkin.id,
      title: `I just checked in at ${checkin.restaurantName}`,
      text: `I just earned ${checkin.awardedPoints} points at ${checkin.restaurantName}.`,
      imageUrl: restaurant?.imageUrl ?? null,
      pointsReward: 50,
      restaurantId: checkin.restaurantId,
      restaurantName: checkin.restaurantName,
      awardedPoints: checkin.awardedPoints,
      createdAt: checkin.createdAt,
    };
  }

  async getRewardSharePreview({ accessToken, redemptionId }) {
    const user = await this.getCurrentUser(accessToken);
    const redemption = await this.requireOwnedRewardRedemption({
      userId: user.uid,
      redemptionId,
    });
    return {
      shareType: 'reward',
      entityId: redemption.id,
      title: `I just redeemed ${redemption.rewardTitle}`,
      text: `I redeemed ${redemption.rewardTitle} for ${redemption.pointsRequired} points.`,
      imageUrl: redemption.rewardImageUrl,
      pointsReward: 100,
      rewardId: redemption.rewardId,
      rewardTitle: redemption.rewardTitle,
      rewardCategory: redemption.rewardCategory,
      redeemedAt: redemption.redeemedAt,
    };
  }

  async getReceiptSharePreview({ accessToken, receiptUploadId }) {
    const user = await this.getCurrentUser(accessToken);
    const receiptUpload = await this.requireOwnedReceiptUpload({
      userId: user.uid,
      receiptUploadId,
    });
    return {
      shareType: 'receipt',
      entityId: receiptUpload.id,
      title: `I uploaded a receipt at ${receiptUpload.restaurantName}`,
      text: `I earned ${receiptUpload.awardedPoints} points from my Food Route receipt upload.`,
      imageUrl: receiptUpload.receiptImageUrl,
      pointsReward: 50,
      restaurantId: receiptUpload.restaurantId,
      restaurantName: receiptUpload.restaurantName,
      awardedPoints: receiptUpload.awardedPoints,
      createdAt: receiptUpload.createdAt,
    };
  }

  async resolveSocialSharePoints({ userId, shareType, entityId }) {
    if (shareType === 'checkin') {
      await this.requireOwnedCheckin({ userId, checkinId: entityId });
      return 50;
    }
    if (shareType === 'receipt') {
      await this.requireOwnedReceiptUpload({ userId, receiptUploadId: entityId });
      return 50;
    }
    await this.requireOwnedRewardRedemption({ userId, redemptionId: entityId });
    return 100;
  }

  async resolveSocialShareEntityId({ userId, shareType, entityId }) {
    const normalized = (entityId ?? '').trim();
    if (normalized) {
      return normalized;
    }
    if (shareType === 'checkin') {
      const recentCheckin = await this.checkinRepository.getRecentByUser(userId);
      if (!recentCheckin) {
        throw new ApplicationError({
          code: 'checkin_not_found',
          message: 'No check-in found for the provided identifier.',
          statusCode: 404,
        });
      }
      return recentCheckin.id;
    }
    if (shareType === 'receipt') {
      if (!this.receiptUploadRepository) {
        throw new Error('Receipt upload repository is not configured.');
      }
      const uploads = await this.receiptUploadRepository.listByUser(userId);
      if (!uploads.length) {
        throw new ApplicationError({
          code: 'receipt_upload_not_found',
          message: 'No receipt upload found for the provided identifier.',
          statusCode: 404,
        });
      }
      return uploads[0].id;
    }
    if (!this.rewardRedemptionRepository) {
      throw new Error('Reward redemption repository is not configured.');
    }
    const redemptions = await this.rewardRedemptionRepository.listByUser(userId);
    if (!redemptions.length) {
      throw new ApplicationError({
        code: 'reward_redemption_not_found',
        message: 'No reward redemption found for the provided identifier.',
        statusCode: 404,
      });
    }
    const recentRedemption = redemptions.reduce((latest, record) =>
      latest.redeemedAt >= record.redeemedAt ? latest : record,
    );
    return recentRedemption.id;
  }

  async requireOwnedCheckin({ userId, checkinId }) {
    const checkin = await this.checkinRepository.getById(checkinId);
    if (!checkin || checkin.userId !== userId) {
      throw new ApplicationError({
        code: 'checkin_not_found',
        message: 'No check-in found for the provided identifier.',
        statusCode: 404,
      });
    }
    return checkin;
  }

  async requireOwnedRewardRedemption({ userId, redemptionId }) {
    if (!this.rewardRedemptionRepository) {
      throw new Error('Reward redemption repository is not configured.');
    }
    const redemption = await this.rewardRedemptionRepository.getById(redemptionId);
    if (!redemption || redemption.userId !== userId) {
      throw new ApplicationError({
        code: 'reward_redemption_not_found',
        message: 'No reward redemption found for the provided identifier.',
        statusCode: 404,
      });
    }
    return redemption;
  }

  async requireOwnedReceiptUpload({ userId, receiptUploadId }) {
    if (!this.receiptUploadRepository) {
      throw new Error('Receipt upload repository is not configured.');
    }
    const receiptUpload = await this.receiptUploadRepository.getById(receiptUploadId);
    if (!receiptUpload || receiptUpload.userId !== userId) {
      throw new ApplicationError({
        code: 'receipt_upload_not_found',
        message: 'No receipt upload found for the provided identifier.',
        statusCode: 404,
      });
    }
    return receiptUpload;
  }

  async getXpHistory({ accessToken, page, pageSize }) {
    const user = await this.getCurrentUser(accessToken);
    return this.xpService.getHistory({ userId: user.uid, page, pageSize });
  }

  async getStreak({ accessToken }) {
    const user = await this.getCurrentUser(accessToken);
    const loginEvents = await this.loginEventRepository.listByUser(user.uid);
    const lastLoginAt = loginEvents.reduce(
      (latest, event) => (!latest || event.createdAt > latest ? event.createdAt : latest),
      null,
    );
    return {
      currentStreak: await this.loginEventRepository.countCurrentStreak(user.uid),
      lastLoginAt,
      hasLoggedInToday: Boolean(lastLoginAt && lastLoginAt.toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10)),
    };
  }

  async getRanks({ accessToken }) {
    return this.leaderboardService.getMyRanks({ accessToken });
  }

  async getLeaderboard({ accessToken, page, pageSize, scope, period }) {
    return this.leaderboardService.listLeaderboard({
      accessToken,
      page,
      pageSize,
      scope,
      period,
    });
  }

  async getSummary({ accessToken }) {
    const user = await this.getCurrentUser(accessToken);
    return {
      xpSummary: await this.xpService.getSummary({ userId: user.uid }),
      pointsSummary: await this.xpService.getPointsSummary({ userId: user.uid }),
      rank: await this.leaderboardService.getMyRanks({ accessToken }),
      streak: await this.getStreak({ accessToken }),
      totalCheckInCount: await this.checkinRepository.countByUser(user.uid),
    };
  }

  async getOverview({ accessToken }) {
    const profile = await this.getMe({ accessToken });
    return {
      profile,
      xpSummary: await this.getXpSummary({ accessToken }),
      pointsSummary: await this.getPointsSummary({ accessToken }),
      rank: await this.leaderboardService.getMyRanks({ accessToken }),
      streak: await this.getStreak({ accessToken }),
      referralSummary: await this.getReferralSummary({ accessToken }),
    };
  }

  async uploadProfileImage({ accessToken, image }) {
    const user = await this.getCurrentUser(accessToken);
    const stored = await this.imageStorage.uploadImage({
      folder: `user_profiles/${user.uid}`,
      file: image,
    });
    const updated = await this.userRepository.updateFields(user.uid, {
      profile_image_url: stored.publicUrl,
    });
    if (!updated) {
      throw new ApplicationError({
        code: 'user_not_found',
        message: 'No end-user account found for the provided credentials.',
        statusCode: 404,
      });
    }
    return profileData(updated);
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

  async scanProximityRecord(user, locationOverride = null) {
    if (!this.proximityAlertRepository || !this.restaurantRepository) {
      return { triggeredAlerts: [], createdCount: 0, pushedCount: 0 };
    }
    if (!user.proximityAlertsEnabled) {
      return { triggeredAlerts: [], createdCount: 0, pushedCount: 0 };
    }
    const thresholdKm =
      user.proximityDistanceKm === null || user.proximityDistanceKm === undefined
        ? DEFAULT_PROXIMITY_DISTANCE_KM
        : user.proximityDistanceKm;

    const userLatitude = locationOverride?.latitude ?? user.lastKnownLatitude;
    const userLongitude = locationOverride?.longitude ?? user.lastKnownLongitude;

    if (userLatitude === null || userLatitude === undefined) {
      return { triggeredAlerts: [], createdCount: 0, pushedCount: 0 };
    }
    if (userLongitude === null || userLongitude === undefined) {
      return { triggeredAlerts: [], createdCount: 0 };
    }

    const nearbyRestaurants = (await this.restaurantRepository.listAll())
      .filter((restaurant) => restaurant.status === 'active')
      .map((restaurant) => ({
        restaurant,
        distanceKm: this.distanceKm(
          userLatitude,
          userLongitude,
          restaurant.latitude,
          restaurant.longitude,
        ),
      }))
      .filter((entry) => entry.distanceKm <= thresholdKm)
      .sort((left, right) => left.distanceKm - right.distanceKm || left.restaurant.name.localeCompare(right.restaurant.name));

    const now = new Date();
    let createdCount = 0;
    let pushedCount = 0;
    const triggeredAlerts = [];

    for (const entry of nearbyRestaurants) {
      const { restaurant, distanceKm } = entry;
      const alertId = buildProximityAlertRecordId({ userId: user.uid, restaurantId: restaurant.id });
      const existing = await this.proximityAlertRepository.getByUserAndRestaurant({
        userId: user.uid,
        restaurantId: restaurant.id,
      });
      const record = {
        id: alertId,
        userId: user.uid,
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        restaurantAddress: restaurant.address,
        city: restaurant.city,
        restaurantLatitude: restaurant.latitude,
        restaurantLongitude: restaurant.longitude,
        userLatitude,
        userLongitude,
        thresholdKm,
        distanceKm,
        mapsUrl: this.buildMapsUrl({
          userLatitude,
          userLongitude,
          restaurantLatitude: restaurant.latitude,
          restaurantLongitude: restaurant.longitude,
        }),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      await this.proximityAlertRepository.create(record);
      if (!existing) {
        createdCount += 1;
      }
      if (await this.shouldTriggerProximityAlert({ userId: user.uid, restaurantId: restaurant.id, now })) {
        await this.recordProximityAlertTrigger({ record, now });
        if (await this.sendProximityPush({ user, record })) {
          pushedCount += 1;
        }
      }
      triggeredAlerts.push({
        id: record.id,
        restaurantId: record.restaurantId,
        restaurantName: record.restaurantName,
        restaurantAddress: record.restaurantAddress,
        city: record.city,
        distanceKm: record.distanceKm,
        thresholdKm: record.thresholdKm,
        mapsUrl: record.mapsUrl,
        createdAt: record.createdAt,
      });
    }

    return { triggeredAlerts, createdCount, pushedCount };
  }

  distanceKm(latitude, longitude, restaurantLatitude, restaurantLongitude) {
    const radiusKm = 6371;
    const lat1 = (latitude * Math.PI) / 180;
    const lon1 = (longitude * Math.PI) / 180;
    const lat2 = (restaurantLatitude * Math.PI) / 180;
    const lon2 = (restaurantLongitude * Math.PI) / 180;
    const deltaLat = lat2 - lat1;
    const deltaLon = lon2 - lon1;
    const a =
      Math.sin(deltaLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return radiusKm * c;
  }

  buildMapsUrl({ userLatitude, userLongitude, restaurantLatitude, restaurantLongitude }) {
    return (
      'https://www.google.com/maps/dir/?api=1' +
      `&origin=${userLatitude},${userLongitude}` +
      `&destination=${restaurantLatitude},${restaurantLongitude}` +
      '&travelmode=driving'
    );
  }

  async sendProximityPush({ user, record }) {
    if (!this.pushNotificationService) {
      return false;
    }
    if (
      this.pushNotificationService.targetingMode !== 'external_id' &&
      !user.pushNotificationToken
    ) {
      return false;
    }
    await this.pushNotificationService.send({
      recipientId: user.uid,
      token: user.pushNotificationToken,
      title: `${record.restaurantName} is nearby`,
      body: `${record.restaurantName} is ${record.distanceKm.toFixed(1)} km away. Open directions to reach it.`,
      data: {
        type: 'proximity_alert',
        restaurantId: record.restaurantId,
        restaurantName: record.restaurantName,
        mapsUrl: record.mapsUrl,
      },
    });
    return true;
  }

  async shouldTriggerProximityAlert({ userId, restaurantId, now }) {
    if (!this.proximityAlertLogRepository) {
      return true;
    }

    const latest = await this.proximityAlertLogRepository.getLatestByUserAndRestaurant({
      userId,
      restaurantId,
    });
    if (!latest?.createdAt) {
      return true;
    }

    const cooldownMs = this.proximityAlertCooldownMinutes * 60 * 1000;
    return now.getTime() - latest.createdAt.getTime() >= cooldownMs;
  }

  async recordProximityAlertTrigger({ record, now }) {
    if (!this.proximityAlertLogRepository) {
      return;
    }

    await this.proximityAlertLogRepository.create({
      userId: record.userId,
      restaurantId: record.restaurantId,
      restaurantName: record.restaurantName,
      restaurantAddress: record.restaurantAddress,
      city: record.city,
      restaurantLatitude: record.restaurantLatitude,
      restaurantLongitude: record.restaurantLongitude,
      userLatitude: record.userLatitude,
      userLongitude: record.userLongitude,
      thresholdKm: record.thresholdKm,
      distanceKm: record.distanceKm,
      mapsUrl: record.mapsUrl,
      createdAt: now,
      updatedAt: now,
    });
  }
}
