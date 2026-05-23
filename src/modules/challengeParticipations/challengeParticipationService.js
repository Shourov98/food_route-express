import { randomUUID } from 'node:crypto';

import { ApplicationError } from '../../core/ApplicationError.js';
import {
  getAuthenticatedAccount,
  requireActiveRoles,
  requireVerifiedAccount,
} from '../../shared/auth/authorization.js';
import { buildPaginationMeta } from '../../shared/pagination.js';
import { buildChallengeParticipationRecordId } from './challengeParticipationRepository.js';

function participationResponse(record) {
  return {
    id: record.id,
    challengeId: record.challengeId,
    challengeTitle: record.challengeTitle,
    challengeDescription: record.challengeDescription,
    rewardPoints: record.rewardPoints,
    userId: record.userId,
    userFullname: record.userFullname,
    userEmail: record.userEmail,
    status: record.status,
    totalCheckIns: record.totalCheckIns,
    progressPercent: record.progressPercent,
    criteria: record.criteria.map((criterion) => ({
      id: criterion.id,
      type: criterion.type,
      requiredCount: criterion.requiredCount,
      currentCount: criterion.currentCount,
      completed: criterion.completed,
    })),
    startedAt: record.startedAt,
    updatedAt: record.updatedAt,
    completedAt: record.completedAt,
  };
}

function participationListItem(record) {
  return {
    id: record.id,
    challengeId: record.challengeId,
    challengeTitle: record.challengeTitle,
    rewardPoints: record.rewardPoints,
    status: record.status,
    totalCheckIns: record.totalCheckIns,
    progressPercent: record.progressPercent,
    startedAt: record.startedAt,
    updatedAt: record.updatedAt,
    completedAt: record.completedAt,
  };
}

export class ChallengeParticipationService {
  constructor({
    challengeRepository,
    participationRepository,
    checkinRepository,
    rewardRepository,
    rewardRedemptionRepository,
    userRepository,
    identityProvider,
    xpService,
  }) {
    this.challengeRepository = challengeRepository;
    this.participationRepository = participationRepository;
    this.checkinRepository = checkinRepository;
    this.rewardRepository = rewardRepository;
    this.rewardRedemptionRepository = rewardRedemptionRepository;
    this.userRepository = userRepository;
    this.identityProvider = identityProvider;
    this.xpService = xpService;
  }

  async startChallenge({ accessToken, challengeId }) {
    const user = await this.getCurrentUser(accessToken);
    const challenge = await this.getActiveChallengeOrError(challengeId);
    const existing = await this.participationRepository.getByUserAndChallenge({
      userId: user.uid,
      challengeId: challenge.id,
    });
    if (existing) {
      return this.refreshParticipation(existing);
    }

    const now = new Date();
    const record = {
      id: buildChallengeParticipationRecordId(),
      challengeId: challenge.id,
      challengeTitle: challenge.title,
      challengeDescription: challenge.description,
      rewardPoints: challenge.rewardPoints,
      userId: user.uid,
      userFullname: user.fullname,
      userEmail: user.email,
      status: 'in_progress',
      criteria: this.buildCriterionState(challenge.criteria, [], now, now, challenge.endAt),
      totalCheckIns: 0,
      progressPercent: 0,
      startedAt: now,
      updatedAt: now,
      completedAt: null,
    };
    await this.participationRepository.create(record);
    return participationResponse(record);
  }

  async listMyParticipations({ accessToken, page, pageSize }) {
    const user = await this.getCurrentUser(accessToken);
    const records = await this.participationRepository.listByUser(user.uid);
    const refreshed = await Promise.all(records.map((record) => this.refreshParticipation(record)));
    const totalItems = refreshed.length;
    const start = (page - 1) * pageSize;
    return {
      items: refreshed.slice(start, start + pageSize).map(participationListItem),
      pagination: buildPaginationMeta({ page, pageSize, totalItems }),
    };
  }

  async getMyParticipation({ accessToken, participationId }) {
    const user = await this.getCurrentUser(accessToken);
    const record = await this.getParticipationOrError(participationId);
    if (record.userId !== user.uid) {
      throw new ApplicationError({
        code: 'challenge_participation_not_found',
        message: 'No challenge participation found for the provided identifier.',
        statusCode: 404,
      });
    }
    return this.refreshParticipation(record);
  }

  async completeParticipation({ accessToken, participationId }) {
    const user = await this.getCurrentUser(accessToken);
    const record = await this.getParticipationOrError(participationId);
    if (record.userId !== user.uid) {
      throw new ApplicationError({
        code: 'challenge_participation_not_found',
        message: 'No challenge participation found for the provided identifier.',
        statusCode: 404,
      });
    }
    const refreshed = await this.refreshParticipation(record);
    if (refreshed.status === 'completed') {
      return refreshed;
    }
    if (!this.isCompleted(refreshed)) {
      throw new ApplicationError({
        code: 'challenge_not_completed',
        message: 'Challenge criteria are not fully completed yet.',
        statusCode: 409,
      });
    }
    const completed = await this.finalizeParticipation({
      record: refreshed,
      user,
      challenge: await this.getChallengeOrError(refreshed.challengeId),
    });
    return participationResponse(completed);
  }

  async listAvailableChallenges({ accessToken, page, pageSize, search = null }) {
    const user = await this.getCurrentUser(accessToken);
    const now = new Date();
    let records = await this.challengeRepository.listAll();
    if (search) {
      const needle = search.trim().toLowerCase();
      records = records.filter(
        (record) =>
          record.title.toLowerCase().includes(needle) ||
          record.description.toLowerCase().includes(needle),
      );
    }
    const items = [];
    for (const challenge of records) {
      const existingParticipation = await this.participationRepository.getByUserAndChallenge({
        userId: user.uid,
        challengeId: challenge.id,
      });
      const participation = existingParticipation
        ? await this.refreshParticipation(existingParticipation)
        : null;
      items.push({
        id: challenge.id,
        title: challenge.title,
        description: challenge.description,
        rewardPoints: challenge.rewardPoints,
        startAt: challenge.startAt,
        endAt: challenge.endAt,
        status: challenge.status,
        criteriaCount: challenge.criteria.length,
        isActiveNow: challenge.status === 'active' && challenge.startAt <= now && now <= challenge.endAt,
        isStarted: participation !== null,
        participationId: participation?.id ?? null,
        progressPercent: participation?.progressPercent ?? null,
        createdAt: challenge.createdAt,
        updatedAt: challenge.updatedAt,
      });
    }
    items.sort((left, right) => {
      if (left.isActiveNow !== right.isActiveNow) return left.isActiveNow ? -1 : 1;
      if (left.startAt.getTime() !== right.startAt.getTime()) return left.startAt - right.startAt;
      return left.title.toLowerCase().localeCompare(right.title.toLowerCase());
    });
    const totalItems = items.length;
    const start = (page - 1) * pageSize;
    return {
      items: items.slice(start, start + pageSize),
      pagination: buildPaginationMeta({ page, pageSize, totalItems }),
    };
  }

  async getChallengeAnalytics({ accessToken, challengeId }) {
    await this.getCurrentAdmin(accessToken);
    const challenge = await this.getChallengeOrError(challengeId);
    const records = await this.participationRepository.listByChallenge(challenge.id);
    const refreshed = await Promise.all(records.map((record) => this.refreshParticipation(record)));
    const completed = refreshed.filter((record) => record.status === 'completed');
    const inProgress = refreshed.filter((record) => record.status === 'in_progress');
    const total = refreshed.length;
    return {
      challengeId: challenge.id,
      challengeTitle: challenge.title,
      totalParticipants: total,
      inProgressParticipants: inProgress.length,
      completedParticipants: completed.length,
      completionRate: total ? Math.round((completed.length / total) * 10000) / 100 : 0,
      averageProgressPercent: total ? Math.round((refreshed.reduce((sum, item) => sum + item.progressPercent, 0) / total) * 100) / 100 : 0,
      totalRewardPointsAwarded: completed.reduce((sum, item) => sum + item.rewardPoints, 0),
    };
  }

  async refreshParticipation(record) {
    const challenge = await this.getChallengeOrError(record.challengeId);
    const currentTime = new Date();
    const upperBound = currentTime < challenge.endAt ? currentTime : challenge.endAt;
    const checkins = (await this.checkinRepository.listByUser(record.userId)).filter(
      (item) => record.startedAt <= item.createdAt && item.createdAt <= upperBound,
    );
    const criteria = this.buildCriterionState(
      challenge.criteria,
      checkins,
      currentTime,
      record.startedAt,
      challenge.endAt,
    );
    const progressPercent = this.progressPercent(criteria);
    const updated = {
      ...record,
      challengeId: challenge.id,
      challengeTitle: challenge.title,
      challengeDescription: challenge.description,
      rewardPoints: challenge.rewardPoints,
      status: record.status === 'completed' ? 'completed' : 'in_progress',
      criteria,
      totalCheckIns: checkins.length,
      progressPercent: record.status === 'completed' ? 100 : progressPercent,
      updatedAt: new Date(),
    };
    const user = await this.userRepository.getByUid(record.userId);
    if (
      user &&
      updated.status !== 'completed' &&
      this.isCompleted(updated)
    ) {
      const completed = await this.finalizeParticipation({ record: updated, user, challenge });
      return participationResponse(completed);
    }
    const stored = await this.storeParticipation(updated);
    return participationResponse(stored);
  }

  async storeParticipation(record) {
    const updated = await this.participationRepository.update(record.id, record);
    if (updated) {
      return updated;
    }
    return this.participationRepository.create(record);
  }

  buildCriterionState(criteria, checkins, now, startedAt, endAt) {
    const activeCheckins = checkins.filter(
      (item) => startedAt <= item.createdAt && item.createdAt <= (now < endAt ? now : endAt),
    );
    return criteria.map((criterion) => {
      const currentCount = this.countForCriterion(criterion.type, activeCheckins);
      return {
        id: criterion.id,
        type: criterion.type,
        requiredCount: criterion.requiredCount,
        currentCount,
        completed: currentCount >= criterion.requiredCount,
      };
    });
  }

  countForCriterion(type, checkins) {
    if (type === 'check_in_count') return checkins.length;
    if (type === 'breakfast_check_ins') return checkins.filter((item) => item.createdAt.getUTCHours() >= 5 && item.createdAt.getUTCHours() < 11).length;
    if (type === 'lunch_check_ins') return checkins.filter((item) => item.createdAt.getUTCHours() >= 11 && item.createdAt.getUTCHours() < 17).length;
    if (type === 'dinner_check_ins') return checkins.filter((item) => item.createdAt.getUTCHours() >= 17 && item.createdAt.getUTCHours() < 23).length;
    return 0;
  }

  progressPercent(criteria) {
    if (criteria.length === 0) return 0;
    const completed = criteria.filter((criterion) => criterion.completed).length;
    return Math.round((completed / criteria.length) * 10000) / 100;
  }

  isCompleted(record) {
    return record.criteria.every((criterion) => criterion.completed);
  }

  async awardCompletionXp(record) {
    const user = await this.userRepository.getByUid(record.userId);
    if (!user) {
      throw new ApplicationError({
        code: 'user_not_found',
        message: 'No end-user account found for the provided credentials.',
        statusCode: 404,
      });
    }
    const xpRecord = await this.xpService.awardXp({
      userId: user.uid,
      delta: record.rewardPoints,
      sourceType: 'challenge_completion',
      sourceId: record.id,
      city: user.city || '',
      country: user.country || '',
    });
    if (!xpRecord) {
      return;
    }
    const pointsRecord = await this.xpService.awardPoints({
      userId: user.uid,
      delta: record.rewardPoints,
      sourceType: 'challenge_completion',
      sourceId: record.id,
      city: user.city || '',
      country: user.country || '',
    });
    if (!pointsRecord) {
      await this.xpService.deleteXpRecord(xpRecord.id);
      throw new ApplicationError({
        code: 'challenge_completion_failed',
        message: 'The challenge reward could not be granted right now.',
        statusCode: 500,
      });
    }
  }

  async finalizeParticipation({ record, user, challenge }) {
    if (challenge.rewardId) {
      await this.grantChallengeReward({
        userId: record.userId,
        rewardId: challenge.rewardId,
        sourceId: record.id,
        city: user.city || '',
        country: user.country || '',
      });
    }
    await this.awardCompletionXp(record);

    const now = new Date();
    const completedRecord = {
      ...record,
      status: 'completed',
      progressPercent: 100,
      updatedAt: now,
      completedAt: record.completedAt ?? now,
    };
    return this.storeParticipation(completedRecord);
  }

  async grantChallengeReward({ userId, rewardId, sourceId, city, country }) {
    const existing = await this.rewardRedemptionRepository.getByUserAndSource({
      userId,
      sourceType: 'challenge_completion',
      sourceId,
    });
    if (existing) {
      return existing;
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

    const redemption = {
      id: randomUUID(),
      rewardId: reward.id,
      userId,
      sourceType: 'challenge_completion',
      sourceId,
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
    };

    await this.rewardRedemptionRepository.create(redemption);
    const updatedReward = {
      ...reward,
      quantityAvailable: reward.quantityAvailable - 1,
      updatedAt: now,
    };
    const rewardUpdated = await this.rewardRepository.update(reward.id, updatedReward);
    if (!rewardUpdated) {
      await this.rewardRedemptionRepository.delete(redemption.id);
      throw new ApplicationError({
        code: 'reward_redemption_failed',
        message: 'The reward could not be redeemed right now.',
        statusCode: 500,
      });
    }
    return redemption;
  }

  async getCurrentUser(accessToken) {
    let user = await getAuthenticatedAccount({
      accessToken,
      identityProvider: this.identityProvider,
      userRepository: this.userRepository,
      notFoundCode: 'user_not_found',
      notFoundMessage: 'No end-user account found for the provided credentials.',
      notFoundStatusCode: 404,
    });
    user = requireActiveRoles({
      record: user,
      allowedRoles: new Set(['user']),
      roleErrorCode: 'user_not_found',
      roleErrorMessage: 'No end-user account found for the provided credentials.',
      roleErrorStatusCode: 404,
      blockedErrorCode: 'user_blocked',
      blockedErrorMessage: 'The user account is blocked.',
    });
    return requireVerifiedAccount({
      record: user,
      errorCode: 'user_not_verified',
      errorMessage: 'The user account is not verified yet.',
    });
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
    return record;
  }

  async getActiveChallengeOrError(challengeId) {
    const challenge = await this.getChallengeOrError(challengeId);
    const now = new Date();
    if (!(challenge.startAt <= now && now <= challenge.endAt)) {
      throw new ApplicationError({
        code: 'challenge_not_active',
        message: 'The challenge is not active yet.',
        statusCode: 409,
      });
    }
    return challenge;
  }

  async getParticipationOrError(participationId) {
    const record = await this.participationRepository.getById(participationId);
    if (!record) {
      throw new ApplicationError({
        code: 'challenge_participation_not_found',
        message: 'No challenge participation found for the provided identifier.',
        statusCode: 404,
      });
    }
    return record;
  }
}
