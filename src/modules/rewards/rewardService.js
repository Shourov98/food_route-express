import { randomUUID } from 'node:crypto';

import { ApplicationError } from '../../core/ApplicationError.js';
import { getAuthenticatedAccount, requireActiveRoles } from '../../shared/auth/authorization.js';
import { buildPaginationMeta } from '../../shared/pagination.js';

function normalizeDate(value) {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value;
  }
  return new Date(value);
}

function rewardStatus(record, now) {
  if (record.hasExpiry && record.expiresAt && record.expiresAt <= now) {
    return 'expired';
  }
  if (record.isActive) {
    return 'active';
  }
  return 'inactive';
}

function rewardResponse(record, now = new Date()) {
  return {
    id: record.id,
    title: record.title,
    description: record.description,
    pointsRequired: record.pointsRequired,
    quantityAvailable: record.quantityAvailable,
    rewardCategory: record.rewardCategory,
    xpPoints: record.xpPoints,
    foodItemName: record.foodItemName,
    discountPercentage: record.discountPercentage,
    giftCardCode: record.giftCardCode,
    termsAndConditions: record.termsAndConditions,
    imageUrl: record.imageUrl,
    isActive: record.isActive,
    hasExpiry: record.hasExpiry,
    expiresAt: record.expiresAt,
    status: rewardStatus(record, now),
    createdBy: record.createdBy,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function rewardListItem(record, now) {
  const response = rewardResponse(record, now);
  delete response.createdBy;
  return response;
}

function userRewardListItem(record, now, currentPoints) {
  return {
    ...rewardListItem(record, now),
    canRedeem: currentPoints >= record.pointsRequired,
    userPoints: currentPoints,
  };
}

export class RewardService {
  constructor({ rewardRepository, userRepository, identityProvider, imageStorage, xpService }) {
    this.rewardRepository = rewardRepository;
    this.userRepository = userRepository;
    this.identityProvider = identityProvider;
    this.imageStorage = imageStorage;
    this.xpService = xpService;
  }

  async createReward({ accessToken, payload, image }) {
    const admin = await this.getCurrentAdmin(accessToken);
    const now = new Date();
    const rewardId = randomUUID();
    const expiresAt = this.normalizeExpiry({
      hasExpiry: payload.hasExpiry,
      expiresAt: payload.expiresAt,
      forUpdate: false,
    });
    const categoryFields = this.resolveCategoryFields({ payload });
    const imageUrl = image
      ? (await this.imageStorage.uploadImage({ folder: `rewards/${rewardId}`, file: image })).publicUrl
      : null;

    const created = await this.rewardRepository.create({
      id: rewardId,
      title: payload.title,
      description: payload.description,
      pointsRequired: payload.pointsRequired,
      quantityAvailable: payload.quantityAvailable,
      rewardCategory: categoryFields.rewardCategory,
      xpPoints: categoryFields.xpPoints,
      foodItemName: categoryFields.foodItemName,
      discountPercentage: categoryFields.discountPercentage,
      giftCardCode: categoryFields.giftCardCode,
      termsAndConditions: categoryFields.termsAndConditions,
      imageUrl,
      isActive: payload.isActive,
      hasExpiry: payload.hasExpiry,
      expiresAt,
      createdBy: admin.uid,
      createdAt: now,
      updatedAt: now,
    });
    return rewardResponse(created, now);
  }

  async updateReward({ accessToken, rewardId, payload, image }) {
    const admin = await this.getCurrentAdmin(accessToken);
    const existing = await this.getRewardRecord(rewardId);
    const hasExpiry = payload.hasExpiry ?? existing.hasExpiry;
    const expiresAtInput = payload.hasExpiresAtField ? payload.expiresAt : existing.expiresAt;
    const categoryFields = this.resolveCategoryFields({ payload, existing });
    let imageUrl = existing.imageUrl;
    if (image) {
      imageUrl = (await this.imageStorage.uploadImage({ folder: `rewards/${rewardId}`, file: image })).publicUrl;
    } else if (payload.hasImageUrlField) {
      imageUrl = payload.imageUrl ?? null;
    }

    const updated = {
      ...existing,
      title: payload.title ?? existing.title,
      description: payload.description ?? existing.description,
      pointsRequired: payload.pointsRequired ?? existing.pointsRequired,
      quantityAvailable: payload.quantityAvailable ?? existing.quantityAvailable,
      rewardCategory: categoryFields.rewardCategory,
      xpPoints: categoryFields.xpPoints,
      foodItemName: categoryFields.foodItemName,
      discountPercentage: categoryFields.discountPercentage,
      giftCardCode: categoryFields.giftCardCode,
      termsAndConditions: categoryFields.termsAndConditions,
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
    };

    await this.rewardRepository.update(rewardId, updated);
    return rewardResponse(updated);
  }

  async deleteReward({ accessToken, rewardId }) {
    await this.getCurrentAdmin(accessToken);
    const deleted = await this.rewardRepository.delete(rewardId);
    if (!deleted) {
      throw new ApplicationError({
        code: 'reward_not_found',
        message: 'No reward found for the provided identifier.',
        statusCode: 404,
      });
    }
  }

  async getReward({ accessToken, rewardId }) {
    await this.getCurrentAccount(accessToken);
    return rewardResponse(await this.getRewardRecord(rewardId));
  }

  async listRewards({
    accessToken,
    page,
    pageSize,
    search,
    statusFilter,
    isActive,
    hasExpiry,
    minPoints,
    maxPoints,
    expiresFrom,
    expiresTo,
    sortBy,
    sortOrder,
  }) {
    await this.getCurrentAccount(accessToken);
    const now = new Date();
    let records = await this.rewardRepository.listAll();
    const normalizedFrom = normalizeDate(expiresFrom);
    const normalizedTo = normalizeDate(expiresTo);

    if (search) {
      const needle = search.trim().toLowerCase();
      records = records.filter(
        (record) =>
          record.title.toLowerCase().includes(needle) ||
          record.description.toLowerCase().includes(needle),
      );
    }
    if (statusFilter) {
      records = records.filter((record) => rewardStatus(record, now) === statusFilter);
    }
    if (isActive !== null && isActive !== undefined) {
      records = records.filter((record) => record.isActive === isActive);
    }
    if (hasExpiry !== null && hasExpiry !== undefined) {
      records = records.filter((record) => record.hasExpiry === hasExpiry);
    }
    if (minPoints !== null && minPoints !== undefined) {
      records = records.filter((record) => record.pointsRequired >= minPoints);
    }
    if (maxPoints !== null && maxPoints !== undefined) {
      records = records.filter((record) => record.pointsRequired <= maxPoints);
    }
    if (normalizedFrom) {
      records = records.filter((record) => record.expiresAt && record.expiresAt >= normalizedFrom);
    }
    if (normalizedTo) {
      records = records.filter((record) => record.expiresAt && record.expiresAt <= normalizedTo);
    }

    records = this.sortRecords(records, { sortBy, sortOrder });
    const totalItems = records.length;
    const start = (page - 1) * pageSize;
    const items = records.slice(start, start + pageSize);

    return {
      items: items.map((record) => rewardListItem(record, now)),
      pagination: buildPaginationMeta({ page, pageSize, totalItems }),
    };
  }

  async listAvailableRewards({
    accessToken,
    page,
    pageSize,
    search,
    minPoints,
    maxPoints,
    sortBy,
    sortOrder,
  }) {
    const user = await this.getCurrentUser(accessToken);
    const now = new Date();
    const currentPoints = await this.xpService.getTotalPoints(user.uid);
    let records = await this.rewardRepository.listAll();

    records = records.filter(
      (record) =>
        record.isActive &&
        (!record.hasExpiry || !record.expiresAt || record.expiresAt > now) &&
        record.quantityAvailable > 0,
    );

    if (search) {
      const needle = search.trim().toLowerCase();
      records = records.filter(
        (record) =>
          record.title.toLowerCase().includes(needle) ||
          record.description.toLowerCase().includes(needle),
      );
    }
    if (minPoints !== null && minPoints !== undefined) {
      records = records.filter((record) => record.pointsRequired >= minPoints);
    }
    if (maxPoints !== null && maxPoints !== undefined) {
      records = records.filter((record) => record.pointsRequired <= maxPoints);
    }

    records = this.sortRecords(records, { sortBy, sortOrder });
    const totalItems = records.length;
    const start = (page - 1) * pageSize;
    const items = records.slice(start, start + pageSize);

    return {
      items: items.map((record) => userRewardListItem(record, now, currentPoints)),
      pagination: buildPaginationMeta({ page, pageSize, totalItems }),
    };
  }

  async getAnalytics({ accessToken }) {
    await this.getCurrentAdmin(accessToken);
    const records = await this.rewardRepository.listAll();
    const now = new Date();

    let activeRewards = 0;
    let inactiveRewards = 0;
    let expiredRewards = 0;
    let noExpiryRewards = 0;
    let lowStockRewards = 0;
    let totalQuantityAvailable = 0;
    let totalPointsRequired = 0;

    for (const record of records) {
      const status = rewardStatus(record, now);
      if (status === 'active') activeRewards += 1;
      else if (status === 'inactive') inactiveRewards += 1;
      else expiredRewards += 1;

      if (!record.hasExpiry) noExpiryRewards += 1;
      if (record.quantityAvailable <= 10) lowStockRewards += 1;
      totalQuantityAvailable += record.quantityAvailable;
      totalPointsRequired += record.pointsRequired;
    }

    return {
      totalRewards: records.length,
      activeRewards,
      inactiveRewards,
      expiredRewards,
      noExpiryRewards,
      lowStockRewards,
      totalQuantityAvailable,
      averagePointsRequired: records.length
        ? Math.round((totalPointsRequired / records.length) * 100) / 100
        : 0,
    };
  }

  resolveCategoryFields({ payload, existing = null }) {
    return {
      rewardCategory:
        payload.rewardCategory ??
        (payload.hasRewardCategoryField ? null : existing?.rewardCategory) ??
        'general_rewards',
      xpPoints: existing?.xpPoints ?? null,
      foodItemName: existing?.foodItemName ?? null,
      discountPercentage: existing?.discountPercentage ?? null,
      giftCardCode: existing?.giftCardCode ?? null,
      termsAndConditions: existing?.termsAndConditions ?? null,
    };
  }

  normalizeExpiry({ hasExpiry, expiresAt, forUpdate }) {
    if (!hasExpiry) {
      return null;
    }
    if (!expiresAt) {
      throw new ApplicationError({
        code: 'invalid_reward_expiry',
        message: "Field 'expiresAt' is required when 'hasExpiry' is true.",
        statusCode: 400,
      });
    }
    const normalized = normalizeDate(expiresAt);
    if (normalized <= new Date()) {
      throw new ApplicationError({
        code: 'invalid_reward_expiry',
        message: `Rewards cannot be ${forUpdate ? 'updated' : 'created'} with an expiry timestamp in the past.`,
        statusCode: 400,
      });
    }
    return normalized;
  }

  sortRecords(records, { sortBy, sortOrder }) {
    const reverse = sortOrder === 'desc';
    const maxDate = new Date('9999-12-31T00:00:00.000Z');
    const sorted = [...records].sort((left, right) => {
      const leftKey = this.sortKey(left, sortBy, maxDate);
      const rightKey = this.sortKey(right, sortBy, maxDate);
      if (leftKey < rightKey) return reverse ? 1 : -1;
      if (leftKey > rightKey) return reverse ? -1 : 1;
      return 0;
    });
    return sorted;
  }

  sortKey(record, sortBy, maxDate) {
    switch (sortBy) {
      case 'updatedAt':
        return `${record.updatedAt.toISOString()}::${record.createdAt.toISOString()}`;
      case 'title':
        return `${record.title.toLowerCase()}::${record.createdAt.toISOString()}`;
      case 'pointsRequired':
        return `${String(record.pointsRequired).padStart(12, '0')}::${record.createdAt.toISOString()}`;
      case 'quantityAvailable':
        return `${String(record.quantityAvailable).padStart(12, '0')}::${record.createdAt.toISOString()}`;
      case 'expiresAt':
        return `${(record.expiresAt ?? maxDate).toISOString()}::${record.createdAt.toISOString()}`;
      case 'createdAt':
      default:
        return `${record.createdAt.toISOString()}::${record.id}`;
    }
  }

  async getRewardRecord(rewardId) {
    const record = await this.rewardRepository.getById(rewardId);
    if (!record) {
      throw new ApplicationError({
        code: 'reward_not_found',
        message: 'No reward found for the provided identifier.',
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
