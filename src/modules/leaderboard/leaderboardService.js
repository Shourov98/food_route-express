import { getAuthenticatedAccount, requireActiveRoles } from '../../shared/auth/authorization.js';
import { buildPaginationMeta } from '../../shared/pagination.js';

export class LeaderboardService {
  constructor({ userRepository, identityProvider, xpRepository, pointsRepository }) {
    this.userRepository = userRepository;
    this.identityProvider = identityProvider;
    this.xpRepository = xpRepository;
    this.pointsRepository = pointsRepository;
  }

  async getMyRanks({ accessToken }) {
    const user = await this.getCurrentUser(accessToken);
    const cityRank = await this.rankForUser(user.uid, { city: user.city ?? null });
    const nationalRank = await this.rankForUser(user.uid, { country: user.country ?? null });
    return {
      city: user.city,
      country: user.country,
      currentXp: await this.totalXp(user.uid),
      currentPoints: await this.totalPoints(user.uid),
      cityRank,
      nationalRank,
    };
  }

  async listLeaderboard({ accessToken, page, pageSize, scope, period }) {
    const user = await this.getCurrentUser(accessToken);
    const since = this.periodStart(period);
    const city = scope === 'local' ? (user.city ?? null) : null;
    const country = scope === 'national' ? (user.country ?? null) : null;
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

  async rankForUser(userId, { city = null, country = null } = {}) {
    const rows = await this.aggregateUserXp({ city, country });
    const index = rows.findIndex((row) => row.user.uid === userId);
    return index === -1 ? null : index + 1;
  }

  async totalXp(userId) {
    const records = await this.xpRepository.listByUser(userId);
    return records
      .filter((record) => record.sourceType !== 'admin_adjustment')
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
        const currentXp = records
          .filter((record) => record.sourceType !== 'admin_adjustment')
          .filter((record) => !since || record.createdAt >= since)
          .reduce((total, record) => total + record.xpDelta, 0);
        const pointsRecords = await this.pointsRepository.listByUser(user.uid);
        const currentPoints = pointsRecords.reduce((total, record) => total + record.pointsDelta, 0);
        return { user, currentXp, currentPoints };
      }),
    );

    rows.sort((left, right) => {
      if (right.currentXp !== left.currentXp) return right.currentXp - left.currentXp;
      return left.user.fullname.localeCompare(right.user.fullname) || left.user.uid.localeCompare(right.user.uid);
    });

    return rows;
  }

  periodStart(period) {
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
