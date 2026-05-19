import { ApplicationError } from '../../core/ApplicationError.js';
import { getAuthenticatedAccount, requireActiveRoles } from '../../shared/auth/authorization.js';
import { buildPaginationMeta } from '../../shared/pagination.js';
import {
  buildChallengeCriterionRecordId,
  buildChallengeRecordId,
} from './challengeRepository.js';

function challengeResponse(record) {
  return {
    id: record.id,
    title: record.title,
    description: record.description,
    rewardPoints: record.rewardPoints,
    rewardId: record.rewardId,
    startAt: record.startAt,
    endAt: record.endAt,
    status: record.status,
    criteria: record.criteria.map((criterion) => ({
      id: criterion.id,
      type: criterion.type,
      requiredCount: criterion.requiredCount,
    })),
    createdBy: record.createdBy,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function challengeListItem(record) {
  return {
    id: record.id,
    title: record.title,
    description: record.description,
    rewardPoints: record.rewardPoints,
    rewardId: record.rewardId,
    startAt: record.startAt,
    endAt: record.endAt,
    status: record.status,
    criteriaCount: record.criteria.length,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export class ChallengeService {
  constructor({
    challengeRepository,
    rewardRepository,
    userRepository,
    identityProvider,
  }) {
    this.challengeRepository = challengeRepository;
    this.rewardRepository = rewardRepository;
    this.userRepository = userRepository;
    this.identityProvider = identityProvider;
  }

  async createChallenge({ accessToken, payload }) {
    const admin = await this.getCurrentAdmin(accessToken);
    const now = new Date();
    const status = this.resolveStatus(payload.status, payload.startAt, payload.endAt, now);
    const record = {
      id: buildChallengeRecordId(),
      title: payload.title,
      description: payload.description,
      rewardPoints: payload.rewardPoints,
      rewardId: await this.resolveRewardId(payload.rewardId),
      startAt: this.normalizeDate(payload.startAt),
      endAt: this.normalizeDate(payload.endAt),
      status,
      criteria: payload.criteria.map((item) => ({
        id: buildChallengeCriterionRecordId(),
        type: item.type,
        requiredCount: item.requiredCount,
      })),
      createdBy: admin.uid,
      createdAt: now,
      updatedAt: now,
    };
    return challengeResponse(await this.challengeRepository.create(record));
  }

  async listChallenges({ accessToken, page, pageSize, search, statusFilter }) {
    await this.getCurrentAdmin(accessToken);
    const now = new Date();
    let records = (await this.challengeRepository.listAll()).map((record) =>
      this.resolveRuntimeStatus(record, now),
    );
    if (search) {
      const needle = search.trim().toLowerCase();
      records = records.filter(
        (record) =>
          record.title.toLowerCase().includes(needle) ||
          record.description.toLowerCase().includes(needle),
      );
    }
    if (statusFilter) {
      records = records.filter((record) => record.status === statusFilter);
    }
    const totalItems = records.length;
    const start = (page - 1) * pageSize;
    return {
      items: records.slice(start, start + pageSize).map(challengeListItem),
      pagination: buildPaginationMeta({ page, pageSize, totalItems }),
    };
  }

  async getChallenge({ accessToken, challengeId }) {
    await this.getCurrentAdmin(accessToken);
    return challengeResponse(await this.getChallengeOrError(challengeId));
  }

  async updateChallenge({ accessToken, challengeId, payload }) {
    await this.getCurrentAdmin(accessToken);
    const existing = await this.getChallengeOrError(challengeId);
    const startAt = payload.startAt ?? existing.startAt;
    const endAt = payload.endAt ?? existing.endAt;
    if (endAt <= startAt) {
      throw new ApplicationError({
        code: 'challenge_date_range_invalid',
        message: "Field 'endAt' must be later than 'startAt'.",
        statusCode: 400,
      });
    }
    const updated = {
      ...existing,
      title: payload.title ?? existing.title,
      description: payload.description ?? existing.description,
      rewardPoints: payload.rewardPoints ?? existing.rewardPoints,
      rewardId: payload.hasRewardIdField ? await this.resolveRewardId(payload.rewardId) : existing.rewardId,
      startAt: this.normalizeDate(startAt),
      endAt: this.normalizeDate(endAt),
      status: this.resolveStatus(payload.status, startAt, endAt, new Date()),
      criteria:
        payload.criteria !== undefined
          ? payload.criteria.map((item) => ({
              id: buildChallengeCriterionRecordId(),
              type: item.type,
              requiredCount: item.requiredCount,
            }))
          : existing.criteria,
      createdBy: existing.createdBy,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    };
    await this.challengeRepository.update(challengeId, updated);
    return challengeResponse(updated);
  }

  async deleteChallenge({ accessToken, challengeId }) {
    await this.getCurrentAdmin(accessToken);
    const deleted = await this.challengeRepository.delete(challengeId);
    if (!deleted) {
      throw new ApplicationError({
        code: 'challenge_not_found',
        message: 'No challenge found for the provided identifier.',
        statusCode: 404,
      });
    }
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

  async getChallengeOrError(challengeId) {
    const record = await this.challengeRepository.getById(challengeId);
    if (!record) {
      throw new ApplicationError({
        code: 'challenge_not_found',
        message: 'No challenge found for the provided identifier.',
        statusCode: 404,
      });
    }
    return this.resolveRuntimeStatus(record, new Date());
  }

  normalizeDate(value) {
    if (value.tzinfo === undefined) {
      return new Date(value);
    }
    return value;
  }

  resolveStatus(explicitStatus, startAt, endAt, now) {
    if (explicitStatus) {
      return explicitStatus;
    }
    if (endAt <= now) {
      return 'completed';
    }
    if (startAt <= now && now <= endAt) {
      return 'active';
    }
    return 'pending';
  }

  resolveRuntimeStatus(record, now) {
    if (record.status === 'completed') {
      return record;
    }
    if (record.endAt <= now) {
      return { ...record, status: 'completed' };
    }
    if (record.startAt <= now && now <= record.endAt) {
      return { ...record, status: 'active' };
    }
    return record;
  }

  async resolveRewardId(rewardId) {
    if (rewardId === null) {
      return null;
    }
    const reward = await this.rewardRepository.getById(rewardId);
    if (!reward) {
      throw new ApplicationError({
        code: 'reward_not_found',
        message: 'No reward found for the provided identifier.',
        statusCode: 404,
      });
    }
    const now = new Date();
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
    return reward.id;
  }
}
