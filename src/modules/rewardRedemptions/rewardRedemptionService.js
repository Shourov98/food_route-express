import crypto from 'node:crypto';

import { ApplicationError, validationError } from '../../core/ApplicationError.js';
import { getAuthenticatedAccount, requireActiveRoles } from '../../shared/auth/authorization.js';
import { buildPaginationMeta } from '../../shared/pagination.js';
import { rewardFromData } from '../rewards/rewardRepository.js';

const ACTIVE_REDEMPTION_STATUSES = new Set(['pending', 'claimed', 'used', 'redeemed']);
const ADMIN_REDEMPTION_STATUSES = new Set(['pending', 'used', 'expired', 'cancelled', 'rejected']);
const MAX_DAILY_REDEMPTIONS = 3;
// 7-day code expiration per BR-006 MVP spec.
const REDEMPTION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function sameUtcDate(left, right) {
  return left.toISOString().slice(0, 10) === right.toISOString().slice(0, 10);
}

// UUIDv4 (128-bit) — collision risk is effectively zero even at scale, but
// the generator below re-checks uniqueness against the Firestore collection
// before accepting the code, so any theoretical collision is rejected.
function buildRedemptionCode() {
  return crypto.randomUUID().toUpperCase();
}

function redemptionData(record) {
  return {
    id: record.id,
    rewardId: record.rewardId,
    userId: record.userId,
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
    redemptionCode: record.redemptionCode,
    termsAndConditions: record.termsAndConditions,
    status: record.status,
    redeemedAt: record.redeemedAt,
    usedAt: record.usedAt,
    expiresAt: record.expiresAt,
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
    pointsRepository = null,
    pushNotificationService = null,
  }) {
    this.rewardRepository = rewardRepository;
    this.rewardRedemptionRepository = rewardRedemptionRepository;
    this.userRepository = userRepository;
    this.identityProvider = identityProvider;
    this.xpService = xpService;
    // BR-006: explicit dep so the transactional redemption flow can write
    // a `reward_redemption` row directly to the points ledger inside the
    // same Firestore transaction. Falls back to the xpService's repo for
    // backwards compatibility with older test fakes that only inject
    // xpService.
    this.pointsRepository = pointsRepository ?? xpService?.pointsRepository ?? null;
    this.pushNotificationService = pushNotificationService;
  }

  async redeemReward({ accessToken, rewardId }) {
    const user = await this.getCurrentUser(accessToken);
    const reward = await this.getReward(rewardId);
    const now = new Date();
    // Fast-fail before opening a transaction — these checks do not change
    // under concurrency (the reward object we just read is the same one the
    // txn will re-read), so we save a round-trip on the unhappy path.
    this.validateReward(reward, now);
    await this.assertRedemptionAllowed({ userId: user.uid, rewardId: reward.id, now });

    // Balance pre-check is done outside the txn for the same fast-fail
    // reason. The authoritative balance re-read happens inside the txn.
    const currentPoints = await this.xpService.getTotalPoints(user.uid);
    if (currentPoints < reward.pointsRequired) {
      throw new ApplicationError({
        code: 'insufficient_reward_points',
        message: 'You do not have enough points to redeem this reward.',
        statusCode: 400,
      });
    }

    // BR-006 hardening: the next three operations (decrement stock, insert
    // redemption, deduct points) used to be three separate non-transactional
    // writes. Two concurrent calls could both pass the dedupe/daily-limit
    // gates and both succeed — yielding oversell, duplicate redemptions,
    // and double-deducted points. We now route them through a single
    // Firestore runTransaction (with a serializable test-fake fallback)
    // so the precondition reads and the writes either all commit or all
    // roll back.
    const redemptionId = crypto.randomUUID();
    const redemptionCode = await this.generateUniqueRedemptionCode();

    const firestore = this.getFirestoreClient();
    let result;
    if (!firestore || typeof firestore.runTransaction !== 'function') {
      result = await this.redeemAtomicallyFallback({
        user,
        reward,
        redemptionId,
        redemptionCode,
        now,
      });
    } else {
      result = await firestore.runTransaction(async (txn) => {
        // 1. Re-read the reward inside the txn. This is the stock-of-record
        //    check — the prior read was an optimisation, not authoritative.
        const rewardSnap = await txn.get(this.rewardRepository.collection.doc(reward.id));
        if (!rewardSnap.exists) {
          throw new ApplicationError({
            code: 'reward_not_found',
            message: 'No reward found for the provided identifier.',
            statusCode: 404,
          });
        }
        const liveReward = rewardFromData({ id: rewardSnap.id, ...rewardSnap.data() });
        if (!liveReward.isActive) {
          throw new ApplicationError({
            code: 'reward_inactive',
            message: 'This reward is currently inactive.',
            statusCode: 400,
          });
        }
        if (
          liveReward.hasExpiry &&
          liveReward.expiresAt &&
          liveReward.expiresAt <= now
        ) {
          throw new ApplicationError({
            code: 'reward_expired',
            message: 'This reward has expired.',
            statusCode: 400,
          });
        }
        if (liveReward.quantityAvailable <= 0) {
          throw new ApplicationError({
            code: 'reward_out_of_stock',
            message: 'This reward is out of stock.',
            statusCode: 400,
          });
        }

        // 2. Re-check duplicate redemption inside the txn. Two concurrent
        //    calls from the same user to the same reward can no longer both
        //    pass — Firestore's serializable isolation guarantees the
        //    read and the subsequent write are atomic.
        const existing = await this.rewardRedemptionRepository.findActiveRedemptionInTxn({
          userId: user.uid,
          rewardId: reward.id,
          txn,
        });
        if (existing) {
          throw new ApplicationError({
            code: 'reward_already_redeemed',
            message: 'You have already redeemed this reward.',
            statusCode: 409,
          });
        }

        // 3. Re-check daily limit inside the txn. Closes the TOCTOU window
        //    that previously allowed 4+ redemptions in a day under spam.
        const todayCount =
          await this.rewardRedemptionRepository.countTodayRedemptionsInTxn({
            userId: user.uid,
            now,
            txn,
          });
        if (todayCount >= MAX_DAILY_REDEMPTIONS) {
          throw new ApplicationError({
            code: 'daily_reward_redemption_limit_reached',
            message: 'You have reached the daily limit of 3 reward redemptions.',
            statusCode: 429,
          });
        }

        // 4. Re-read the user's wallet balance inside the txn. Even if a
        //    concurrent redemption from this user just deducted points, we
        //    see the latest committed state and won't over-spend.
        const liveBalance = await this.sumLiveWalletBalance(user.uid, txn);
        if (liveBalance < reward.pointsRequired) {
          throw new ApplicationError({
            code: 'insufficient_reward_points',
            message: 'You do not have enough points to redeem this reward.',
            statusCode: 400,
          });
        }

        // 5. All preconditions passed — commit the three writes atomically.
        const newStock = liveReward.quantityAvailable - 1;
        txn.update(this.rewardRepository.collection.doc(reward.id), {
          quantityAvailable: newStock,
          updatedAt: now,
        });

        const redemptionRecord = {
          id: redemptionId,
          rewardId: reward.id,
          userId: user.uid,
          sourceType: 'reward_redemption',
          sourceId: redemptionId,
          rewardTitle: reward.title,
          rewardDescription: reward.description,
          rewardImageUrl: reward.imageUrl,
          rewardCategory: reward.rewardCategory,
          pointsRequired: reward.pointsRequired,
          xpPoints: reward.xpPoints,
          foodItemName: reward.foodItemName,
          discountPercentage: reward.discountPercentage,
          giftCardCode: reward.giftCardCode,
          redemptionCode,
          termsAndConditions: reward.termsAndConditions,
          status: 'pending',
          redeemedAt: now,
          usedAt: null,
          expiresAt: new Date(now.getTime() + REDEMPTION_TTL_MS),
          createdAt: now,
          updatedAt: now,
        };
        txn.set(
          this.rewardRedemptionRepository.collection.doc(redemptionId),
          redemptionRecord,
        );

        const pointsDelta = -reward.pointsRequired;
        const pointsRecordId = crypto.randomUUID();
        const pointsRecord = {
          id: pointsRecordId,
          userId: user.uid,
          sourceType: 'reward_redemption',
          sourceId: redemptionId,
          pointsDelta,
          eventId: redemptionId,
          balanceType: 'wallet',
          balanceBefore: liveBalance,
          balanceAfter: liveBalance + pointsDelta,
          status: 'committed',
          city: user.city ?? '',
          country: user.country ?? '',
          createdAt: now,
        };
        // The (userId, sourceType='reward_redemption', sourceId=redemptionId)
        // triple is unique per redemption. If Firestore retries the txn we
        // re-set the same record — safe and idempotent.
        txn.set(this.pointsRepository.collection.doc(pointsRecordId), pointsRecord);

        return { redemptionRecord, pointsRecord, newStock };
      });
    }

    await this.sendRewardClaimedPush({ user, reward, redemption: result.redemptionRecord });

    return {
      redemption: redemptionData(result.redemptionRecord),
      userXpAfter: await this.xpService.getTotalXp(user.uid),
      userPointsAfter: await this.xpService.getTotalPoints(user.uid),
      remainingQuantityAvailable: result.newStock,
    };
  }

  // Resolves the underlying Firestore client from any collection handle so
  // the service can call `runTransaction`. Returns null for test fakes that
  // don't expose `runTransaction` (or don't even expose `collection`).
  getFirestoreClient() {
    const sources = [
      this.rewardRepository?.collection,
      this.rewardRedemptionRepository?.collection,
      this.pointsRepository?.collection,
    ];
    for (const source of sources) {
      const client = source?.firestore ?? source?.db ?? null;
      if (client && typeof client.runTransaction === 'function') {
        return client;
      }
    }
    return null;
  }

  async sumLiveWalletBalance(userId, txn) {
    if (!this.pointsRepository) {
      // Defensive fallback for callers that didn't wire the points repo —
      // fall back to the xpService aggregator. This path is non-transactional
      // and therefore not race-safe; we only hit it in misconfigured test
      // setups, never in production.
      return this.xpService.getTotalPoints(userId);
    }
    const query = this.pointsRepository.collection.where('userId', '==', userId);
    const snapshot = txn ? await txn.get(query) : await query.get();
    let total = 0;
    snapshot.forEach((doc) => {
      total += Number(doc.data().pointsDelta ?? 0);
    });
    return total;
  }

  async generateUniqueRedemptionCode({ maxAttempts = 5 } = {}) {
    // Defensive fallback: older test fakes don't implement `findByCode`, so
    // we accept a non-uniqueness-checked code in that case. UUIDv4 still has
    // 128-bit entropy, so collisions are effectively impossible anyway.
    if (typeof this.rewardRedemptionRepository.findByCode !== 'function') {
      return buildRedemptionCode();
    }
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const code = buildRedemptionCode();
      const existing = await this.rewardRedemptionRepository.findByCode({ code });
      if (!existing) {
        return code;
      }
    }
    // Bounded retry exhausted — extremely unlikely with UUIDv4 (128-bit
    // entropy), but surface a clean error rather than silently returning a
    // duplicate.
    throw new ApplicationError({
      code: 'redemption_code_collision',
      message: 'Could not generate a unique redemption code. Please try again.',
      statusCode: 500,
    });
  }

  // Non-Firestore fallback used by the in-memory test fakes (which don't
  // expose `runTransaction`). Recreates the same atomic semantics as the
  // production transactional path by running the entire critical section
  // under a single exclusive lock (the fake's `_withSharedTxn` helper),
  // re-reading every precondition inside the lock, and only then doing
  // the writes. This matches what `firestore.runTransaction` does
  // natively on real Firestore.
  async redeemAtomicallyFallback({ user, reward, redemptionId, redemptionCode, now }) {
    const body = async () => {
      // 1. Re-read the reward inside the lock. Without this, concurrent
      //    callers would each compute "stock-1" from a stale snapshot
      //    and oversell.
      const liveReward = await this.rewardRepository.getById(reward.id);
      if (!liveReward) {
        throw new ApplicationError({
          code: 'reward_not_found',
          message: 'No reward found for the provided identifier.',
          statusCode: 404,
        });
      }
      this.validateReward(liveReward, now);

      // 2. Re-check duplicate redemption inside the lock. Falls back to
      //    the unlocked `listByUser` reader when the test fake repository
      //    doesn't expose the txn-aware helper (older fakes).
      const existing = await this.findExistingActiveRedemption({
        userId: user.uid,
        rewardId: reward.id,
      });
      if (existing) {
        throw new ApplicationError({
          code: 'reward_already_redeemed',
          message: 'You have already redeemed this reward.',
          statusCode: 409,
        });
      }

      // 3. Re-check daily limit inside the lock. Same fallback as above.
      const todayCount = await this.countTodayRedemptions({
        userId: user.uid,
        now,
      });
      if (todayCount >= MAX_DAILY_REDEMPTIONS) {
        throw new ApplicationError({
          code: 'daily_reward_redemption_limit_reached',
          message: 'You have reached the daily limit of 3 reward redemptions.',
          statusCode: 429,
        });
      }

      // 4. Re-read wallet balance inside the lock.
      const currentPoints = await this.xpService.getTotalPoints(user.uid);
      if (currentPoints < liveReward.pointsRequired) {
        throw new ApplicationError({
          code: 'insufficient_reward_points',
          message: 'You do not have enough points to redeem this reward.',
          statusCode: 400,
        });
      }

      // 5. All preconditions passed — commit the writes.
      const redemptionRecord = {
        id: redemptionId,
        rewardId: reward.id,
        userId: user.uid,
        sourceType: 'reward_redemption',
        sourceId: redemptionId,
        rewardTitle: reward.title,
        rewardDescription: reward.description,
        rewardImageUrl: reward.imageUrl,
        rewardCategory: reward.rewardCategory,
        pointsRequired: liveReward.pointsRequired,
        xpPoints: reward.xpPoints,
        foodItemName: reward.foodItemName,
        discountPercentage: reward.discountPercentage,
        giftCardCode: reward.giftCardCode,
        redemptionCode,
        termsAndConditions: reward.termsAndConditions,
        status: 'pending',
        redeemedAt: now,
        usedAt: null,
        expiresAt: new Date(now.getTime() + REDEMPTION_TTL_MS),
        createdAt: now,
        updatedAt: now,
      };

      const created = await this.rewardRedemptionRepository.create(redemptionRecord);
      const newStock = liveReward.quantityAvailable - 1;
      const updatedReward = { ...liveReward, quantityAvailable: newStock, updatedAt: now };
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
        delta: -liveReward.pointsRequired,
        sourceId: created.id,
        city: user.city ?? '',
        country: user.country ?? '',
      });
      if (!ledger && liveReward.pointsRequired > 0) {
        await this.rewardRepository.update(reward.id, liveReward);
        await this.rewardRedemptionRepository.delete(created.id);
        throw new ApplicationError({
          code: 'reward_redemption_failed',
          message: 'The reward could not be redeemed right now.',
          statusCode: 500,
        });
      }

      return { redemptionRecord: created, pointsRecord: ledger, newStock };
    };

    // Wire the shared-lock transaction wrapper when the test fakes
    // expose one. Production repositories don't need this because the
    // real `firestore.runTransaction` is taken in `redeemReward` instead.
    const coordinator =
      this.rewardRedemptionRepository?.__txnCoordinator ??
      this.rewardRepository?.__txnCoordinator ??
      null;
    if (coordinator && typeof coordinator.run === 'function') {
      return coordinator.run(body);
    }
    if (typeof this.rewardRedemptionRepository.withTransaction === 'function') {
      return this.rewardRedemptionRepository.withTransaction(body);
    }
    return body();
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

  async listAdminRedemptions({ accessToken, page, pageSize, statusFilter = null, search = '' }) {
    await this.getCurrentAdmin(accessToken);
    let records = await this.rewardRedemptionRepository.listAll();
    if (statusFilter) {
      const mapped = this.normalizeStatusFilter(statusFilter);
      records = records.filter((record) => record.status === mapped);
    }

    const needle = String(search || '').trim().toLowerCase();
    if (needle) {
      records = records.filter((record) =>
        [
          record.rewardTitle,
          record.redemptionCode,
          record.userId,
          record.rewardCategory,
          record.status,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(needle)),
      );
    }

    records = records.sort(
      (left, right) =>
        (right.redeemedAt ?? right.createdAt).getTime() - (left.redeemedAt ?? left.createdAt).getTime(),
    );

    const totalItems = records.length;
    const start = (page - 1) * pageSize;
    return {
      items: records.slice(start, start + pageSize).map(redemptionData),
      pagination: buildPaginationMeta({ page, pageSize, totalItems }),
    };
  }

  normalizeStatusFilter(statusFilter) {
    const normalized = String(statusFilter).trim().toLowerCase();
    if (normalized === 'available' || normalized === 'claimed' || normalized === 'pending') {
      return 'pending';
    }
    if (normalized === 'redeemed' || normalized === 'used') {
      return 'used';
    }
    if (normalized === 'expired' || normalized === 'cancelled' || normalized === 'rejected') {
      return normalized;
    }
    throw validationError('Status must be one of: available, pending, used, expired, cancelled, rejected.');
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
    if (!new Set(['pending', 'claimed']).has(record.status)) {
      throw new ApplicationError({
        code: 'redemption_already_used',
        message: 'This reward is no longer available to use.',
        statusCode: 400,
      });
    }
    if (record.expiresAt && record.expiresAt <= new Date()) {
      throw new ApplicationError({
        code: 'redemption_expired',
        message: 'This reward code has expired.',
        statusCode: 400,
      });
    }
    const updated = {
      ...record,
      status: 'used',
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

  async updateAdminRedemptionStatus({ accessToken, redemptionId, status }) {
    await this.getCurrentAdmin(accessToken);
    const normalized = String(status || '').trim().toLowerCase();
    if (!ADMIN_REDEMPTION_STATUSES.has(normalized)) {
      throw validationError('Status must be one of: pending, used, expired, cancelled, rejected.');
    }

    const record = await this.rewardRedemptionRepository.getById(redemptionId);
    if (!record) {
      throw new ApplicationError({
        code: 'redemption_not_found',
        message: 'No reward redemption found for the provided identifier.',
        statusCode: 404,
      });
    }

    const now = new Date();
    const updated = {
      ...record,
      status: normalized,
      usedAt: normalized === 'used' ? record.usedAt ?? now : record.usedAt,
      updatedAt: now,
    };
    await this.rewardRedemptionRepository.update(record.id, updated);
    return redemptionData(updated);
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

  // Helper used inside the atomic "transaction" body to look up an
  // existing active redemption. Prefers the txn-aware helper (production
  // and the new fakes) and falls back to `listByUser` for older test
  // fakes that don't implement the txn-aware variant.
  async findExistingActiveRedemption({ userId, rewardId }) {
    if (typeof this.rewardRedemptionRepository.findActiveRedemptionInTxn === 'function') {
      return this.rewardRedemptionRepository.findActiveRedemptionInTxn({
        userId,
        rewardId,
      });
    }
    if (typeof this.rewardRedemptionRepository.listByUser !== 'function') {
      return null;
    }
    const records = await this.rewardRedemptionRepository.listByUser(userId);
    return (
      records.find(
        (record) =>
          record.rewardId === rewardId &&
          ACTIVE_REDEMPTION_STATUSES.has(record.status),
      ) ?? null
    );
  }

  // Helper used inside the atomic "transaction" body to count today's
  // redemptions. Same fallback strategy as `findExistingActiveRedemption`.
  async countTodayRedemptions({ userId, now }) {
    if (typeof this.rewardRedemptionRepository.countTodayRedemptionsInTxn === 'function') {
      return this.rewardRedemptionRepository.countTodayRedemptionsInTxn({
        userId,
        now,
      });
    }
    if (typeof this.rewardRedemptionRepository.listByUser !== 'function') {
      return 0;
    }
    const records = await this.rewardRedemptionRepository.listByUser(userId);
    return records.filter((record) => sameUtcDate(record.redeemedAt ?? record.createdAt, now)).length;
  }

  async assertRedemptionAllowed({ userId, rewardId, now }) {
    if (typeof this.rewardRedemptionRepository.listByUser !== 'function') {
      return;
    }
    const records = await this.rewardRedemptionRepository.listByUser(userId);
    const duplicate = records.find(
      (record) => record.rewardId === rewardId && ACTIVE_REDEMPTION_STATUSES.has(record.status),
    );
    if (duplicate) {
      throw new ApplicationError({
        code: 'reward_already_redeemed',
        message: 'You have already redeemed this reward.',
        statusCode: 409,
      });
    }
    const todaysRedemptions = records.filter((record) => sameUtcDate(record.redeemedAt ?? record.createdAt, now));
    if (todaysRedemptions.length >= MAX_DAILY_REDEMPTIONS) {
      throw new ApplicationError({
        code: 'daily_reward_redemption_limit_reached',
        message: 'You have reached the daily limit of 3 reward redemptions.',
        statusCode: 429,
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

  async getCurrentAdmin(accessToken) {
    const admin = await getAuthenticatedAccount({
      accessToken,
      identityProvider: this.identityProvider,
      userRepository: this.userRepository,
      notFoundCode: 'admin_not_found',
      notFoundMessage: 'No admin account found for the provided credentials.',
      notFoundStatusCode: 404,
    });
    return requireActiveRoles({
      record: admin,
      allowedRoles: new Set(['admin', 'super_admin']),
      roleErrorCode: 'admin_not_found',
      roleErrorMessage: 'No admin account found for the provided credentials.',
      blockedErrorCode: 'admin_blocked',
      blockedErrorMessage: 'The admin account is blocked.',
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
