import { getAuthenticatedAccount, requireActiveRoles } from '../../shared/auth/authorization.js';
import { buildPaginationMeta } from '../../shared/pagination.js';
import { isEarningSourceType } from './rankingPolicy.js';
import { isUserActiveForRanking, INACTIVITY_CONFIG_DEFAULTS } from './inactivityPolicy.js';

export class LeaderboardService {
  constructor({
    userRepository,
    identityProvider,
    xpRepository,
    pointsRepository,
    inactivityConfig = INACTIVITY_CONFIG_DEFAULTS,
  }) {
    this.userRepository = userRepository;
    this.identityProvider = identityProvider;
    this.xpRepository = xpRepository;
    this.pointsRepository = pointsRepository;
    this.inactivityConfig = inactivityConfig;
  }

  async getMyRanks({ accessToken, scope }) {
    const user = await this.getCurrentUser(accessToken);
    const requestedScope = scope ?? null;
    const cityRank = await this.rankForUser(user.uid, { city: user.city ?? null });
    const nationalRank = await this.rankForUser(user.uid, { country: user.country ?? null });
    const worldwideRank = requestedScope === 'worldwide' || requestedScope === 'all'
      ? await this.rankForUser(user.uid, {})
      : null;
    return {
      city: user.city,
      country: user.country,
      scope: requestedScope ?? 'all',
      currentXp: await this.totalXp(user.uid),
      currentPoints: await this.totalPoints(user.uid),
      cityRank,
      nationalRank,
      worldwideRank: worldwideRank ?? null,
    };
  }

  async listLeaderboard({ accessToken, page, pageSize, scope, period }) {
    const user = await this.getCurrentUser(accessToken);
    const since = this.periodStart(period);
    const { city, country } = this.resolveScopeFilters(scope, user);
    const ordered = await this.aggregateUserXp({ since, city, country });
    const totalItems = ordered.length;
    const start = (page - 1) * pageSize;
    const pageItems = ordered.slice(start, start + pageSize);

    return {
      scope,
      period,
      items: pageItems.map((row, index) => ({
        rank: start + index + 1,
        userId: row.user.uid,
        fullname: row.user.fullname,
        city: row.user.city,
        country: row.user.country,
        profileImageUrl: row.user.profileImageUrl,
        currentXp: row.currentXp,
        currentPoints: row.currentPoints,
      })),
      pagination: buildPaginationMeta({ page, pageSize, totalItems }),
    };
  }

  /**
   * Map a scope string to city/country filter arguments.
   *   'local'     -> city = user.city (filtered to one city)
   *   'national'  -> country = user.country (filtered to one country)
   *   'worldwide' -> no city/country filter (all users)
   */
  resolveScopeFilters(scope, user) {
    if (scope === 'local') {
      return { city: user.city ?? null, country: null };
    }
    if (scope === 'national') {
      return { city: null, country: user.country ?? null };
    }
    return { city: null, country: null };
  }

  async rankForUser(userId, { city = null, country = null } = {}) {
    const rows = await this.aggregateUserXp({ city, country });
    const index = rows.findIndex((row) => row.user.uid === userId);
    return index === -1 ? null : index + 1;
  }

  async totalXp(userId) {
    const records = await this.xpRepository.listByUser(userId);
    return records
      .filter((record) => isEarningSourceType(record.sourceType))
      .reduce((total, record) => total + record.xpDelta, 0);
  }

  async totalPoints(userId) {
    const records = await this.pointsRepository.listByUser(userId);
    return records.reduce((total, record) => total + record.pointsDelta, 0);
  }

  async aggregateUserXp({ since = null, city = null, country = null } = {}) {
    const users = (await this.userRepository.listByRole('user')).filter(
      (user) =>
        user.isVerified &&
        !user.isBlocked &&
        (city === null || (user.city ?? '') === city) &&
        (country === null || (user.country ?? '') === country),
    );

    const rows = await Promise.all(
      users.map(async (user) => {
        const records = await this.xpRepository.listByUser(user.uid);
        const activityRecords = records
          .filter((record) => isEarningSourceType(record.sourceType))
          .filter((record) => !since || record.createdAt >= since);
        const currentXp = activityRecords
          .reduce((total, record) => total + record.xpDelta, 0);
        const pointsRecords = await this.pointsRepository.listByUser(user.uid);
        const currentPoints = pointsRecords.reduce((total, record) => total + record.pointsDelta, 0);
        const validCheckins = activityRecords.filter((record) => record.sourceType === 'check_in').length;
        const firstScoreAt = activityRecords.reduce(
          (earliest, record) => (!earliest || record.createdAt < earliest ? record.createdAt : earliest),
          null,
        );
        const latestActivityAt = activityRecords.reduce(
          (latest, record) => (!latest || record.createdAt > latest ? record.createdAt : latest),
          null,
        );
        return { user, currentXp, currentPoints, validCheckins, firstScoreAt, latestActivityAt };
      }),
    );

    // BR-008: rank filter is applied uniformly across all three periods
    // (weekly / monthly / all_time). For period=weekly|monthly the service
    // has already filtered xp_ledger rows by `since`, so `currentXp > 0`
    // means "has earned XP inside this window". For period=all_time, no
    // window is applied, so `currentXp > 0` means "has any earned XP at
    // all" — which is the natural reading of "active user" for an
    // all-time board. See inactivityPolicy.isUserActiveForRanking.
    const activeRows = rows.filter((row) => isUserActiveForRanking(row, this.inactivityConfig));
    activeRows.sort((left, right) => {
      if (right.currentXp !== left.currentXp) return right.currentXp - left.currentXp;
      if (right.validCheckins !== left.validCheckins) return right.validCheckins - left.validCheckins;
      if (left.firstScoreAt && right.firstScoreAt && left.firstScoreAt.getTime() !== right.firstScoreAt.getTime()) {
        return left.firstScoreAt.getTime() - right.firstScoreAt.getTime();
      }
      if (left.latestActivityAt && right.latestActivityAt && left.latestActivityAt.getTime() !== right.latestActivityAt.getTime()) {
        return right.latestActivityAt.getTime() - left.latestActivityAt.getTime();
      }
      return left.user.fullname.localeCompare(right.user.fullname) || left.user.uid.localeCompare(right.user.uid);
    });

    return activeRows;
  }

  periodStart(period) {
    if (period === 'all_time') {
      return null;
    }
    const now = new Date();
    if (period === 'monthly') {
      return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
    }
    const day = now.getUTCDay();
    const offset = day === 0 ? 6 : day - 1;
    const start = new Date(now);
    start.setUTCDate(now.getUTCDate() - offset);
    start.setUTCHours(0, 0, 0, 0);
    return start;
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