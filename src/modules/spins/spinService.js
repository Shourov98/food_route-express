import { randomInt, randomUUID } from 'node:crypto';

import { ApplicationError } from '../../core/ApplicationError.js';
import { getAuthenticatedAccount, requireActiveRoles } from '../../shared/auth/authorization.js';
import { buildPaginationMeta } from '../../shared/pagination.js';

function isoDay(date) {
  return date.toISOString().slice(0, 10);
}

function cryptoRandomNumber() {
  return randomInt(0, 1_000_000_000) / 1_000_000_000;
}

function rewardItem(record) {
  return {
    id: record.id,
    title: record.title,
    description: record.description,
    rewardCategory: record.rewardCategory,
    pointsReward: record.pointsReward,
    discountPercentage: record.pointsReward,
    pointsRequired: record.pointsRequired,
    quantityAvailable: record.quantityAvailable,
    probability: record.probability,
    imageUrl: record.imageUrl,
    isActive: record.isActive,
    hasExpiry: record.hasExpiry,
    expiresAt: record.expiresAt,
    isSynthetic: record.id === 'no_reward',
    isInfiniteStock: record.id === 'no_reward',
  };
}

function historyItem(record) {
  return {
    id: record.id,
    userId: record.userId,
    rewardId: record.rewardId,
    rewardTitle: record.rewardTitle,
    rewardDescription: record.rewardDescription,
    rewardCategory: record.rewardCategory,
    pointsReward: record.pointsReward,
    discountPercentage: record.pointsReward,
    pointsRequired: record.pointsRequired,
    imageUrl: record.rewardImageUrl,
    spunAt: record.spunAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    isSynthetic: record.isSynthetic,
  };
}

export class SpinService {
  constructor({
    dailyRewardRepository,
    spinRepository,
    spinSettingsRepository,
    userRepository,
    identityProvider,
    xpService,
    randomNumber = cryptoRandomNumber,
  }) {
    this.dailyRewardRepository = dailyRewardRepository;
    this.spinRepository = spinRepository;
    this.spinSettingsRepository = spinSettingsRepository;
    this.userRepository = userRepository;
    this.identityProvider = identityProvider;
    this.xpService = xpService;
    this.randomNumber = randomNumber;
  }

  async listSpinRewards({ accessToken }) {
    await this.getCurrentUser(accessToken);
    const rewards = await this.spinableRewards();
    return {
      items: rewards.map(rewardItem),
      totalItems: rewards.length,
    };
  }

  async spin({ accessToken }) {
    const user = await this.getCurrentUser(accessToken);
    const now = new Date();
    await this.refreshDailyRewards(now);
    const settings = await this.getSettings();
    const currentBoundary = this.spinEligibilityBoundary(now, settings);
    const latest = await this.spinRepository.getLatestByUser(user.uid);
    if (latest && latest.spunAt >= currentBoundary) {
      throw new ApplicationError({
        code: 'spin_already_used',
        message: 'You have already used your spin for the current eligibility window.',
        statusCode: 400,
      });
    }

    const rewards = await this.spinableRewards();
    if (rewards.length === 0) {
      throw new ApplicationError({
        code: 'spin_rewards_unavailable',
        message: 'No spin rewards are currently available.',
        statusCode: 400,
      });
    }

    const chosen = this.chooseReward(rewards);
    const isSynthetic = chosen.id === 'no_reward';
    if (!isSynthetic) {
      chosen.quantityAvailable -= 1;
      chosen.updatedAt = now;
      await this.dailyRewardRepository.update(chosen.id, chosen);
    }

    const created = await this.spinRepository.create({
      id: randomUUID(),
      userId: user.uid,
      rewardId: chosen.id,
      rewardTitle: chosen.title,
      rewardDescription: chosen.description,
      rewardCategory: chosen.rewardCategory,
      pointsReward: chosen.pointsReward,
      pointsRequired: chosen.pointsRequired,
      rewardImageUrl: chosen.imageUrl,
      isSynthetic,
      spunAt: now,
      createdAt: now,
      updatedAt: now,
    });

    if (!isSynthetic && chosen.pointsReward > 0) {
      await this.xpService.awardXp({
        userId: user.uid,
        delta: chosen.pointsReward,
        sourceType: 'daily_reward_spin',
        sourceId: created.id,
        city: user.city ?? '',
        country: user.country ?? '',
      });
      await this.xpService.awardPoints({
        userId: user.uid,
        delta: chosen.pointsReward,
        sourceType: 'daily_reward_spin',
        sourceId: created.id,
        city: user.city ?? '',
        country: user.country ?? '',
      });
    }

    return {
      spin: historyItem(created),
      remainingQuantityAvailable: isSynthetic ? 0 : chosen.quantityAvailable,
      nextSpinAt: this.nextSpinAt(currentBoundary, settings),
      isInfiniteStock: isSynthetic,
    };
  }

  async listHistory({ accessToken, page, pageSize }) {
    const user = await this.getCurrentUser(accessToken);
    const records = await this.spinRepository.listByUser(user.uid);
    const totalItems = records.length;
    const start = (page - 1) * pageSize;
    return {
      items: records.slice(start, start + pageSize).map(historyItem),
      pagination: buildPaginationMeta({ page, pageSize, totalItems }),
    };
  }

  async getAdminAnalytics({ accessToken }) {
    await this.getCurrentAdmin(accessToken);
    const now = new Date();
    const settings = await this.getSettings();
    await this.refreshDailyRewards(now);
    const spins = await this.spinRepository.listAll();
    const totalSpinsToday = spins.filter((record) => isoDay(record.spunAt) === isoDay(now)).length;
    const activeRewards = (await this.dailyRewardRepository.listAll()).filter((record) =>
      this.rewardAvailable(record, now),
    );
    const totalInitial = activeRewards.reduce(
      (sum, record) => sum + (record.initialQuantityAvailable ?? record.quantityAvailable),
      0,
    );
    const totalUsed = activeRewards.reduce((sum, record) => {
      const initial = record.initialQuantityAvailable ?? record.quantityAvailable;
      return initial > 0 ? sum + (initial - record.quantityAvailable) : sum;
    }, 0);

    return {
      totalSpinsToday,
      avgRedemptionRate: totalInitial ? Math.round((totalUsed / totalInitial) * 1000) / 10 : 0,
      currentResetCycle: settings.resetLogic === 'daily' ? '24 Hours' : 'Manual',
      resetLogic: settings.resetLogic,
      resetTimeUtc: settings.resetTimeUtc,
      totalProbability:
        activeRewards.reduce((sum, record) => sum + Math.max(record.probability, 0), 0) +
        Math.max(settings.noRewardProbability, 0),
      noRewardProbability: settings.noRewardProbability,
      isProbabilityConfigured:
        activeRewards.reduce((sum, record) => sum + Math.max(record.probability, 0), 0) +
          Math.max(settings.noRewardProbability, 0) >
        0,
    };
  }

  async getAdminSettings({ accessToken }) {
    await this.getCurrentAdmin(accessToken);
    return this.getSettings();
  }

  async updateAdminSettings({ accessToken, payload }) {
    await this.getCurrentAdmin(accessToken);
    this.validateResetTime(payload.resetTimeUtc);
    if (payload.noRewardProbability !== null && payload.noRewardProbability !== undefined) {
      this.validateProbability(payload.noRewardProbability);
    }
    const existing = await this.getSettings();
    return this.spinSettingsRepository.update({
      id: existing.id,
      resetLogic: payload.resetLogic,
      resetTimeUtc: payload.resetTimeUtc,
      noRewardProbability:
        payload.noRewardProbability !== null && payload.noRewardProbability !== undefined
          ? payload.noRewardProbability
          : existing.noRewardProbability,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    });
  }

  async spinableRewards() {
    const now = new Date();
    const rewards = await this.availableRewards(now);
    rewards.push(this.noRewardReward(now, await this.getSettings()));
    return rewards;
  }

  async availableRewards(now) {
    await this.refreshDailyRewards(now);
    const rewards = [];
    for (const record of await this.dailyRewardRepository.listAll()) {
      if (this.rewardAvailable(record, now)) {
        rewards.push(record);
      }
    }
    return rewards.sort((left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id));
  }

  rewardAvailable(record, now) {
    if (!record.isActive) return false;
    if (record.quantityAvailable <= 0) return false;
    if (record.hasExpiry && record.expiresAt && record.expiresAt <= now) return false;
    return true;
  }

  noRewardReward(now, settings) {
    return {
      id: 'no_reward',
      title: 'No Points',
      description: 'No points this time.',
      rewardCategory: 'points',
      pointsReward: 0,
      pointsRequired: 0,
      quantityAvailable: 2147483647,
      probability: settings.noRewardProbability,
      initialQuantityAvailable: 2147483647,
      imageUrl: null,
      isActive: true,
      hasExpiry: false,
      expiresAt: null,
      createdBy: 'system',
      createdAt: now,
      updatedAt: now,
      lastResetAt: now,
    };
  }

  async refreshDailyRewards(now) {
    const settings = await this.getSettings();
    for (const record of await this.dailyRewardRepository.listAll()) {
      if (!this.shouldReset(record, now, settings)) {
        continue;
      }
      const initial = record.initialQuantityAvailable ?? record.quantityAvailable;
      await this.dailyRewardRepository.update(record.id, {
        ...record,
        quantityAvailable: initial,
        initialQuantityAvailable: initial,
        lastResetAt: now,
        updatedAt: now,
      });
    }
  }

  shouldReset(record, now, settings) {
    if (settings.resetLogic !== 'daily') {
      return false;
    }
    const boundary = this.resetBoundary(now, settings.resetTimeUtc);
    if (!record.lastResetAt) {
      return true;
    }
    return record.lastResetAt < boundary;
  }

  resetBoundary(now, resetTimeUtc) {
    this.validateResetTime(resetTimeUtc);
    const [hour, minute] = resetTimeUtc.split(':').map(Number);
    const boundary = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, minute, 0, 0),
    );
    if (now < boundary) {
      boundary.setUTCDate(boundary.getUTCDate() - 1);
    }
    return boundary;
  }

  spinEligibilityBoundary(now, settings) {
    if (settings.resetLogic === 'daily') {
      return this.resetBoundary(now, settings.resetTimeUtc);
    }
    const boundary = new Date(now);
    boundary.setUTCHours(0, 0, 0, 0);
    return boundary;
  }

  nextSpinAt(currentBoundary, settings) {
    const next = new Date(currentBoundary);
    if (settings.resetLogic === 'daily') {
      next.setUTCDate(next.getUTCDate() + 1);
      return next;
    }
    next.setUTCDate(next.getUTCDate() + 1);
    return next;
  }

  validateResetTime(resetTimeUtc) {
    const parts = String(resetTimeUtc).split(':');
    if (parts.length !== 2 || !parts.every((part) => /^\d+$/.test(part))) {
      throw new ApplicationError({
        code: 'invalid_reset_time',
        message: "Field 'resetTimeUtc' must use HH:MM 24-hour format.",
        statusCode: 400,
      });
    }
    const hour = Number(parts[0]);
    const minute = Number(parts[1]);
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      throw new ApplicationError({
        code: 'invalid_reset_time',
        message: "Field 'resetTimeUtc' must be a valid UTC time in HH:MM format.",
        statusCode: 400,
      });
    }
  }

  validateProbability(probability) {
    if (probability < 0 || probability > 100) {
      throw new ApplicationError({
        code: 'invalid_spin_probability',
        message: "Field 'noRewardProbability' must be between 0 and 100.",
        statusCode: 400,
      });
    }
  }

  async getSettings() {
    const record = await this.spinSettingsRepository.getCurrent();
    if (!new Set(['daily', 'manual']).has(record.resetLogic)) {
      return {
        id: 'current',
        resetLogic: 'daily',
        resetTimeUtc: '00:00',
        noRewardProbability: 0,
        createdAt: record.createdAt ?? new Date(),
        updatedAt: record.updatedAt ?? new Date(),
      };
    }
    this.validateResetTime(record.resetTimeUtc);
    this.validateProbability(record.noRewardProbability);
    return record;
  }

  chooseReward(rewards) {
    const weights = rewards.map((record) => Math.max(record.probability, 0));
    const total = weights.reduce((sum, value) => sum + value, 0);
    if (total <= 0) {
      return rewards[Math.floor(this.randomNumber() * rewards.length)];
    }
    let target = this.randomNumber() * total;
    for (let index = 0; index < rewards.length; index += 1) {
      target -= weights[index];
      if (target <= 0) {
        return rewards[index];
      }
    }
    return rewards[rewards.length - 1];
  }

  async getCurrentAdmin(accessToken) {
    const record = await getAuthenticatedAccount({
      accessToken,
      identityProvider: this.identityProvider,
      userRepository: this.userRepository,
      notFoundCode: 'admin_not_found',
      notFoundMessage: 'No admin account found for the provided credentials.',
      notFoundStatusCode: 403,
    });
    return requireActiveRoles({
      record,
      allowedRoles: new Set(['admin', 'super_admin']),
      roleErrorCode: 'admin_not_found',
      roleErrorMessage: 'No admin account found for the provided credentials.',
      blockedErrorCode: 'admin_blocked',
      blockedErrorMessage: 'The admin account is blocked.',
    });
  }

  async getCurrentUser(accessToken) {
    const record = await getAuthenticatedAccount({
      accessToken,
      identityProvider: this.identityProvider,
      userRepository: this.userRepository,
      notFoundCode: 'user_not_found',
      notFoundMessage: 'No end-user account found for the provided credentials.',
      notFoundStatusCode: 404,
    });
    return requireActiveRoles({
      record,
      allowedRoles: new Set(['user']),
      roleErrorCode: 'user_not_found',
      roleErrorMessage: 'No end-user account found for the provided credentials.',
      roleErrorStatusCode: 404,
      blockedErrorCode: 'user_blocked',
      blockedErrorMessage: 'The user account is blocked.',
    });
  }
}
