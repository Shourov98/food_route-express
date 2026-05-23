import crypto from 'node:crypto';

import { ApplicationError, validationError } from '../../core/ApplicationError.js';
import { getAuthenticatedAccount, requireActiveRoles } from '../../shared/auth/authorization.js';
import { buildPaginationMeta } from '../../shared/pagination.js';

function redemptionData(record) {
  return {
    id: record.id,
    rewardId: record.rewardId,
    sourceType: record.sourceType,
    sourceId: record.sourceId,
    rewardTitle: record.rewardTitle,
    rewardDescription: record.rewardDescription,
    rewardImageUrl: record.rewardImageUrl,
    rewardCategory: record.rewardCategory,
    pointsRequired: record.pointsRequired,
    xpPoints: record.xpPoints,
    foodItemName: record.foodItemName,
    discountPercentage: record.discountPercentage,
    giftCardCode: record.giftCardCode,
    termsAndConditions: record.termsAndConditions,
    status: record.status,
    redeemedAt: record.redeemedAt,
    usedAt: record.usedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export class RewardRedemptionService {
  constructor({
    rewardRepository,
    rewardRedemptionRepository,
    userRepository,
    identityProvider,
    xpService,
    pushNotificationService = null,
  }) {
    this.rewardRepository = rewardRepository;
    this.rewardRedemptionRepository = rewardRedemptionRepository;
    this.userRepository = userRepository;
    this.identityProvider = identityProvider;
    this.xpService = xpService;
    this.pushNotificationService = pushNotificationService;
  }

  async redeemReward({ accessToken, rewardId }) {
    const user = await this.getCurrentUser(accessToken);
    const reward = await this.getReward(rewardId);
    const now = new Date();
    this.validateReward(reward, now);

    const currentPoints = await this.xpService.getTotalPoints(user.uid);
    if (currentPoints < reward.pointsRequired) {
      throw new ApplicationError({
        code: 'insufficient_reward_points',
        message: 'You do not have enough points to redeem this reward.',
        statusCode: 400,
      });
    }

    const created = await this.rewardRedemptionRepository.create({
      id: crypto.randomUUID(),
      rewardId: reward.id,
      userId: user.uid,
      sourceType: null,
      sourceId: null,
      rewardTitle: reward.title,
      rewardDescription: reward.description,
      rewardImageUrl: reward.imageUrl,
      rewardCategory: reward.rewardCategory,
      pointsRequired: reward.pointsRequired,
      xpPoints: reward.xpPoints,
      foodItemName: reward.foodItemName,
      discountPercentage: reward.discountPercentage,
      giftCardCode: reward.giftCardCode,
      termsAndConditions: reward.termsAndConditions,
      status: 'claimed',
      redeemedAt: now,
      usedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    const updatedReward = {
      ...reward,
      quantityAvailable: reward.quantityAvailable - 1,
      updatedAt: now,
    };
    const rewardUpdate = await this.rewardRepository.update(reward.id, updatedReward);
    if (!rewardUpdate) {
      await this.rewardRedemptionRepository.delete(created.id);
      throw new ApplicationError({
        code: 'reward_redemption_failed',
        message: 'The reward could not be redeemed right now.',
        statusCode: 500,
      });
    }

    const ledger = await this.xpService.adjustPoints({
      userId: user.uid,
      delta: -reward.pointsRequired,
      sourceId: created.id,
      city: user.city ?? '',
      country: user.country ?? '',
    });
    if (!ledger && reward.pointsRequired > 0) {
      await this.rewardRepository.update(reward.id, reward);
      await this.rewardRedemptionRepository.delete(created.id);
      throw new ApplicationError({
        code: 'reward_redemption_failed',
        message: 'The reward could not be redeemed right now.',
        statusCode: 500,
      });
    }

    await this.sendRewardClaimedPush({ user, reward, redemption: created });

    return {
      redemption: redemptionData(created),
      userXpAfter: await this.xpService.getTotalXp(user.uid),
      userPointsAfter: await this.xpService.getTotalPoints(user.uid),
      remainingQuantityAvailable: updatedReward.quantityAvailable,
    };
  }

  async listMyRewards({ accessToken, page, pageSize, statusFilter = null }) {
    const user = await this.getCurrentUser(accessToken);
    let records = await this.rewardRedemptionRepository.listByUser(user.uid);
    if (statusFilter) {
      const mapped = this.normalizeStatusFilter(statusFilter);
      records = records.filter((record) => record.status === mapped);
    }
    const totalItems = records.length;
    const start = (page - 1) * pageSize;
    return {
      items: records.slice(start, start + pageSize).map(redemptionData),
      pagination: buildPaginationMeta({ page, pageSize, totalItems }),
    };
  }

  normalizeStatusFilter(statusFilter) {
    const normalized = String(statusFilter).trim().toLowerCase();
    if (normalized === 'available' || normalized === 'claimed') {
      return 'claimed';
    }
    if (normalized === 'redeemed') {
      return 'redeemed';
    }
    throw validationError('Status must be one of: available, claimed, redeemed.');
  }

  async redeemOwnedReward({ accessToken, redemptionId }) {
    const user = await this.getCurrentUser(accessToken);
    const record = await this.rewardRedemptionRepository.getById(redemptionId);
    if (!record || record.userId !== user.uid) {
      throw new ApplicationError({
        code: 'redemption_not_found',
        message: 'No reward redemption found for the provided identifier.',
        statusCode: 404,
      });
    }
    if (record.status !== 'claimed') {
      throw new ApplicationError({
        code: 'redemption_already_used',
        message: 'This reward has already been redeemed.',
        statusCode: 400,
      });
    }
    const updated = {
      ...record,
      status: 'redeemed',
      usedAt: new Date(),
      updatedAt: new Date(),
    };
    await this.rewardRedemptionRepository.update(record.id, updated);
    const reward = await this.rewardRepository.getById(record.rewardId);
    return {
      redemption: redemptionData(updated),
      userXpAfter: await this.xpService.getTotalXp(user.uid),
      userPointsAfter: await this.xpService.getTotalPoints(user.uid),
      remainingQuantityAvailable: reward?.quantityAvailable ?? 0,
    };
  }

  validateReward(reward, now) {
    if (!reward.isActive) {
      throw new ApplicationError({
        code: 'reward_inactive',
        message: 'This reward is currently inactive.',
        statusCode: 400,
      });
    }
    if (reward.hasExpiry && reward.expiresAt && reward.expiresAt <= now) {
      throw new ApplicationError({
        code: 'reward_expired',
        message: 'This reward has expired.',
        statusCode: 400,
      });
    }
    if (reward.quantityAvailable <= 0) {
      throw new ApplicationError({
        code: 'reward_out_of_stock',
        message: 'This reward is out of stock.',
        statusCode: 400,
      });
    }
  }

  async getReward(rewardId) {
    const reward = await this.rewardRepository.getById(rewardId);
    if (!reward) {
      throw new ApplicationError({
        code: 'reward_not_found',
        message: 'No reward found for the provided identifier.',
        statusCode: 404,
      });
    }
    return reward;
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

  async sendRewardClaimedPush({ user, reward, redemption }) {
    if (!this.pushNotificationService) {
      return;
    }
    if (
      this.pushNotificationService.targetingMode !== 'external_id' &&
      !user.pushNotificationToken
    ) {
      return;
    }

    try {
      await this.pushNotificationService.send({
        recipientId: user.uid,
        token: user.pushNotificationToken,
        title: 'Reward claimed',
        body: `You successfully claimed ${reward.title}.`,
        data: {
          type: 'reward_claimed',
          rewardId: reward.id,
          redemptionId: redemption.id,
        },
      });
    } catch {
      // Reward redemption should succeed even if push delivery fails.
    }
  }
}
