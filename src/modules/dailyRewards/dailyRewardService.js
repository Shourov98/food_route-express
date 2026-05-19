import { randomUUID } from 'node:crypto';

import { ApplicationError } from '../../core/ApplicationError.js';
import { getAuthenticatedAccount, requireActiveRoles } from '../../shared/auth/authorization.js';
import { buildPaginationMeta } from '../../shared/pagination.js';

export const DAILY_REWARD_TITLE = 'Points Reward';
export const DAILY_REWARD_DESCRIPTION = 'Claim a fixed points reward.';

function dailyRewardStatus(record, now) {
  if (record.hasExpiry && record.expiresAt && record.expiresAt <= now) {
    return 'expired';
  }
  if (record.isActive) {
    return 'active';
  }
  return 'inactive';
}

function responseData(record, now = new Date()) {
  return {
    id: record.id,
    title: DAILY_REWARD_TITLE,
    description: DAILY_REWARD_DESCRIPTION,
    rewardCategory: 'points',
    pointsReward: record.pointsReward,
    discountPercentage: record.pointsReward,
    quantityAvailable: record.quantityAvailable,
    probability: record.probability,
    imageUrl: record.imageUrl,
    isActive: record.isActive,
    hasExpiry: record.hasExpiry,
    expiresAt: record.expiresAt,
    status: dailyRewardStatus(record, now),
    createdBy: record.createdBy,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function listItem(record, now) {
  const result = responseData(record, now);
  delete result.createdBy;
  return result;
}

export class DailyRewardService {
  constructor({ dailyRewardRepository, userRepository, identityProvider, imageStorage }) {
    this.dailyRewardRepository = dailyRewardRepository;
    this.userRepository = userRepository;
    this.identityProvider = identityProvider;
    this.imageStorage = imageStorage;
  }

  async createDailyReward({ accessToken, payload, image }) {
    const admin = await this.getCurrentAdmin(accessToken);
    const now = new Date();
    const rewardId = randomUUID();
    const created = await this.dailyRewardRepository.create({
      id: rewardId,
      title: DAILY_REWARD_TITLE,
      description: DAILY_REWARD_DESCRIPTION,
      rewardCategory: 'points',
      pointsReward: payload.pointsReward ?? 0,
      pointsRequired: 0,
      quantityAvailable: payload.quantityAvailable,
      probability: payload.probability,
      initialQuantityAvailable: payload.quantityAvailable,
      imageUrl: image
        ? (await this.imageStorage.uploadImage({ folder: `daily_rewards/${rewardId}`, file: image }))
            .publicUrl
        : null,
      isActive: payload.isActive,
      hasExpiry: payload.hasExpiry,
      expiresAt: this.normalizeExpiry({
        hasExpiry: payload.hasExpiry,
        expiresAt: payload.expiresAt,
        forUpdate: false,
      }),
      createdBy: admin.uid,
      createdAt: now,
      updatedAt: now,
      lastResetAt: now,
    });
    return responseData(created, now);
  }

  async updateDailyReward({ accessToken, rewardId, payload, image }) {
    const admin = await this.getCurrentAdmin(accessToken);
    const existing = await this.getDailyRewardRecord(rewardId);
    const hasExpiry = payload.hasExpiry ?? existing.hasExpiry;
    const expiresAtInput = payload.hasExpiresAtField ? payload.expiresAt : existing.expiresAt;
    let imageUrl = existing.imageUrl;
    if (image) {
      imageUrl = (
        await this.imageStorage.uploadImage({ folder: `daily_rewards/${rewardId}`, file: image })
      ).publicUrl;
    } else if (payload.hasImageUrlField) {
      imageUrl = payload.imageUrl ?? null;
    }

    const updated = {
      ...existing,
      title: DAILY_REWARD_TITLE,
      description: DAILY_REWARD_DESCRIPTION,
      pointsReward: payload.pointsReward ?? existing.pointsReward,
      rewardCategory: 'points',
      pointsRequired: 0,
      quantityAvailable: payload.quantityAvailable ?? existing.quantityAvailable,
      probability: payload.probability ?? existing.probability,
      initialQuantityAvailable: payload.quantityAvailable ?? existing.initialQuantityAvailable,
      imageUrl,
      isActive: payload.isActive ?? existing.isActive,
      hasExpiry,
      expiresAt: this.normalizeExpiry({
        hasExpiry,
        expiresAt: expiresAtInput,
        forUpdate: true,
      }),
      createdBy: existing.createdBy || admin.uid,
      updatedAt: new Date(),
      lastResetAt: existing.lastResetAt,
    };
    await this.dailyRewardRepository.update(rewardId, updated);
    return responseData(updated);
  }

  async deleteDailyReward({ accessToken, rewardId }) {
    await this.getCurrentAdmin(accessToken);
    const deleted = await this.dailyRewardRepository.delete(rewardId);
    if (!deleted) {
      throw new ApplicationError({
        code: 'daily_reward_not_found',
        message: 'No daily reward found for the provided identifier.',
        statusCode: 404,
      });
    }
  }

  async getDailyReward({ accessToken, rewardId }) {
    await this.getCurrentAccount(accessToken);
    this.refreshDailyRewards(new Date());
    return responseData(await this.getDailyRewardRecord(rewardId));
  }

  async listDailyRewards({
    accessToken,
    page,
    pageSize,
    search,
    statusFilter,
    isActive,
    hasExpiry,
    expiresFrom,
    expiresTo,
    sortBy,
    sortOrder,
  }) {
    await this.getCurrentAccount(accessToken);
    const now = new Date();
    await this.refreshDailyRewards(now);
    let records = await this.dailyRewardRepository.listAll();

    if (search) {
      const needle = search.trim().toLowerCase();
      records = records.filter(
        (record) =>
          record.title.toLowerCase().includes(needle) ||
          record.description.toLowerCase().includes(needle) ||
          String(record.pointsReward).includes(needle) ||
          String(record.quantityAvailable).includes(needle) ||
          String(record.probability).includes(needle),
      );
    }
    if (statusFilter) {
      records = records.filter((record) => dailyRewardStatus(record, now) === statusFilter);
    }
    if (isActive !== null && isActive !== undefined) {
      records = records.filter((record) => record.isActive === isActive);
    }
    if (hasExpiry !== null && hasExpiry !== undefined) {
      records = records.filter((record) => record.hasExpiry === hasExpiry);
    }
    if (expiresFrom) {
      records = records.filter((record) => record.expiresAt && record.expiresAt >= expiresFrom);
    }
    if (expiresTo) {
      records = records.filter((record) => record.expiresAt && record.expiresAt <= expiresTo);
    }

    records = this.sortRecords(records, { sortBy, sortOrder });
    const totalItems = records.length;
    const start = (page - 1) * pageSize;
    const items = records.slice(start, start + pageSize);

    return {
      items: items.map((record) => listItem(record, now)),
      pagination: buildPaginationMeta({ page, pageSize, totalItems }),
    };
  }

  async getAnalytics({ accessToken }) {
    await this.getCurrentAdmin(accessToken);
    const now = new Date();
    await this.refreshDailyRewards(now);
    const records = await this.dailyRewardRepository.listAll();

    let activeRewards = 0;
    let inactiveRewards = 0;
    let expiredRewards = 0;
    let noExpiryRewards = 0;
    let lowStockRewards = 0;
    let totalQuantityAvailable = 0;
    let totalPointsReward = 0;
    const lowStockAlerts = [];

    for (const record of records) {
      const status = dailyRewardStatus(record, now);
      if (status === 'active') activeRewards += 1;
      else if (status === 'inactive') inactiveRewards += 1;
      else expiredRewards += 1;

      if (!record.hasExpiry) noExpiryRewards += 1;
      if (this.isLowStock(record)) {
        lowStockRewards += 1;
        lowStockAlerts.push(this.lowStockAlert(record));
      }
      totalQuantityAvailable += record.quantityAvailable;
      totalPointsReward += record.pointsReward;
    }

    lowStockAlerts.sort(
      (left, right) =>
        left.stockRemainingPercent - right.stockRemainingPercent || left.title.localeCompare(right.title),
    );

    const average = records.length ? Math.round((totalPointsReward / records.length) * 100) / 100 : 0;
    return {
      totalRewards: records.length,
      activeRewards,
      inactiveRewards,
      expiredRewards,
      noExpiryRewards,
      lowStockRewards,
      totalQuantityAvailable,
      averagePointsReward: average,
      averageDiscountPercentage: average,
      lowStockAlerts,
    };
  }

  async refreshDailyRewards(now) {
    for (const record of await this.dailyRewardRepository.listAll()) {
      if (!this.shouldReset(record, now)) {
        continue;
      }
      const initialQuantity =
        record.initialQuantityAvailable ?? record.quantityAvailable;
      const refreshed = {
        ...record,
        quantityAvailable: initialQuantity,
        initialQuantityAvailable: initialQuantity,
        lastResetAt: now,
        updatedAt: now,
      };
      await this.dailyRewardRepository.update(record.id, refreshed);
    }
  }

  shouldReset(record, now) {
    if (!record.lastResetAt) {
      return true;
    }
    return record.lastResetAt.toISOString().slice(0, 10) < now.toISOString().slice(0, 10);
  }

  isLowStock(record) {
    const initial = record.initialQuantityAvailable;
    if (!initial || initial <= 0) {
      return false;
    }
    return record.quantityAvailable / initial < 0.2;
  }

  lowStockAlert(record) {
    const initial = record.initialQuantityAvailable || record.quantityAvailable;
    return {
      id: record.id,
      title: DAILY_REWARD_TITLE,
      quantityAvailable: record.quantityAvailable,
      initialQuantityAvailable: initial,
      stockRemainingPercent: initial > 0 ? Math.round((record.quantityAvailable / initial) * 10000) / 100 : 0,
      isLowStock: true,
    };
  }

  normalizeExpiry({ hasExpiry, expiresAt, forUpdate }) {
    if (!hasExpiry) {
      return null;
    }
    if (!expiresAt) {
      throw new ApplicationError({
        code: 'invalid_daily_reward_expiry',
        message: "Field 'expiresAt' is required when 'hasExpiry' is true.",
        statusCode: 400,
      });
    }
    const normalized = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
    if (normalized <= new Date()) {
      throw new ApplicationError({
        code: 'invalid_daily_reward_expiry',
        message: `Daily rewards cannot be ${forUpdate ? 'updated' : 'created'} with an expiry timestamp in the past.`,
        statusCode: 400,
      });
    }
    return normalized;
  }

  sortRecords(records, { sortBy, sortOrder }) {
    const reverse = sortOrder === 'desc';
    const maxDate = new Date('9999-12-31T00:00:00.000Z');
    return [...records].sort((left, right) => {
      const leftKey = this.sortKey(left, sortBy, maxDate);
      const rightKey = this.sortKey(right, sortBy, maxDate);
      if (leftKey < rightKey) return reverse ? 1 : -1;
      if (leftKey > rightKey) return reverse ? -1 : 1;
      return 0;
    });
  }

  sortKey(record, sortBy, maxDate) {
    switch (sortBy) {
      case 'discountPercentage':
      case 'pointsReward':
        return `${String(record.pointsReward).padStart(12, '0')}::${record.createdAt.toISOString()}`;
      case 'quantityAvailable':
        return `${String(record.quantityAvailable).padStart(12, '0')}::${record.createdAt.toISOString()}`;
      case 'probability':
        return `${String(record.probability).padStart(12, '0')}::${record.createdAt.toISOString()}`;
      case 'expiresAt':
        return `${(record.expiresAt ?? maxDate).toISOString()}::${record.createdAt.toISOString()}`;
      case 'updatedAt':
        return `${record.updatedAt.toISOString()}::${record.createdAt.toISOString()}`;
      case 'createdAt':
      default:
        return `${record.createdAt.toISOString()}::${record.id}`;
    }
  }

  async getDailyRewardRecord(rewardId) {
    const record = await this.dailyRewardRepository.getById(rewardId);
    if (!record) {
      throw new ApplicationError({
        code: 'daily_reward_not_found',
        message: 'No daily reward found for the provided identifier.',
        statusCode: 404,
      });
    }
    return record;
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

  async getCurrentAccount(accessToken) {
    const record = await getAuthenticatedAccount({
      accessToken,
      identityProvider: this.identityProvider,
      userRepository: this.userRepository,
    });
    return requireActiveRoles({
      record,
      allowedRoles: new Set(['user', 'admin', 'super_admin']),
      roleErrorCode: 'account_not_found',
      roleErrorMessage: 'No account found for the provided credentials.',
      roleErrorStatusCode: 404,
      blockedErrorCode: 'account_blocked',
      blockedErrorMessage: 'The account is blocked.',
    });
  }
}
