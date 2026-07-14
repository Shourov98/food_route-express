import crypto from 'node:crypto';

import { buildPaginationMeta } from '../../shared/pagination.js';
import { isEarningSourceType } from '../leaderboard/rankingPolicy.js';

const DEFAULT_LEVELS = [
  { name: 'Explorer', minXp: 0 },
  { name: 'Pathfinder', minXp: 300 },
  { name: 'Scout', minXp: 700 },
  { name: 'Ranger', minXp: 1300 },
  { name: 'Trailblazer', minXp: 2300 },
  { name: 'Voyager', minXp: 4000 },
  { name: 'Tastemaker', minXp: 7000 },
  { name: 'Vanguard', minXp: 11500 },
  { name: 'Elite', minXp: 18000 },
  { name: 'Legend', minXp: 25500 },
];

const MAX_XP = 30000;
const ADMIN_ADJUSTMENT = 'admin_adjustment';

export class XpService {
  constructor({ xpRepository, pointsRepository, levelRepository = null }) {
    this.xpRepository = xpRepository;
    this.pointsRepository = pointsRepository;
    this.levelRepository = levelRepository;
  }

  async getTotalXp(userId) {
    const records = await this.xpRepository.listByUser(userId);
    return Math.min(
      MAX_XP,
      records
        .filter((record) => isEarningSourceType(record.sourceType))
        .reduce((total, record) => total + record.xpDelta, 0),
    );
  }

  async getTotalPoints(userId) {
    const records = await this.pointsRepository.listByUser(userId);
    return records.reduce((total, record) => total + record.pointsDelta, 0);
  }

  async getSummary({ userId }) {
    const currentXp = await this.getTotalXp(userId);
    const levels = await this.getLevels();
    let currentLevel = 1;
    for (const [index, level] of levels.slice(1).entries()) {
      if (currentXp >= level.minXp) {
        currentLevel = index + 2;
      }
    }
    const current = levels[currentLevel - 1];
    const next = levels[currentLevel] ?? null;
    const progressPercent = next
      ? Math.round(((currentXp - current.minXp) / Math.max(1, next.minXp - current.minXp)) * 10000) / 100
      : 100;

    return {
      currentXp,
      maxXp: MAX_XP,
      currentLevel,
      currentLevelName: current.name,
      nextLevelXp: next?.minXp ?? null,
      progressPercent,
    };
  }

  async getLevels() {
    if (this.levelRepository) {
      const levels = await this.levelRepository.listAll();
      if (levels.length) {
        return levels
          .map((level) => ({ name: level.name, minXp: level.minXp }))
          .sort((left, right) => left.minXp - right.minXp);
      }
    }
    return DEFAULT_LEVELS;
  }

  async getPointsSummary({ userId }) {
    return { currentPoints: await this.getTotalPoints(userId) };
  }

  async listPointsRecords() {
    return this.pointsRepository.listAll();
  }

  async getHistory({ userId, page, pageSize }) {
    const records = (await this.xpRepository.listByUser(userId))
      .filter((record) => record.sourceType !== ADMIN_ADJUSTMENT)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
    const totalItems = records.length;
    const start = (page - 1) * pageSize;
    return {
      items: records.slice(start, start + pageSize).map((record) => ({
        id: record.id,
        sourceType: record.sourceType,
        sourceId: record.sourceId,
        xpDelta: record.xpDelta,
        createdAt: record.createdAt,
      })),
      pagination: buildPaginationMeta({ page, pageSize, totalItems }),
    };
  }

  async getPointsHistory({ userId, page, pageSize }) {
    const records = (await this.pointsRepository.listByUser(userId))
      .slice()
      .sort((left, right) => {
        const timeDiff = left.createdAt.getTime() - right.createdAt.getTime();
        return timeDiff !== 0 ? timeDiff : left.id.localeCompare(right.id);
      });

    let runningBalance = 0;
    const withBalance = records.map((record) => {
      const hasStoredBalance = Number.isFinite(record.balanceAfter) && record.balanceAfter !== 0;
      const balanceBefore = hasStoredBalance ? record.balanceBefore : runningBalance;
      runningBalance = hasStoredBalance ? record.balanceAfter : runningBalance + record.pointsDelta;
      return {
        id: record.id,
        sourceType: record.sourceType,
        sourceId: record.sourceId,
        pointsDelta: record.pointsDelta,
        eventId: record.eventId ?? record.sourceId,
        balanceType: record.balanceType ?? 'wallet',
        balanceBefore,
        balanceAfter: runningBalance,
        status: record.status ?? 'committed',
        createdAt: record.createdAt,
      };
    });

    withBalance.sort((left, right) => {
      const timeDiff = right.createdAt.getTime() - left.createdAt.getTime();
      return timeDiff !== 0 ? timeDiff : right.id.localeCompare(left.id);
    });

    const totalItems = withBalance.length;
    const start = (page - 1) * pageSize;
    return {
      items: withBalance.slice(start, start + pageSize),
      pagination: buildPaginationMeta({ page, pageSize, totalItems }),
    };
  }

  async awardXp({ userId, delta, sourceType, sourceId, city, country }) {
    if (delta <= 0) {
      return null;
    }
    // BR-002/BR-003: race-free idempotent award. The repository uses a
    // Firestore transaction so two concurrent scans with the same sourceId
    // cannot both insert and double-award XP. Returns the freshly created
    // record on success, or `null` if a row already existed for this triple.
    const currentXp = await this.getTotalXp(userId);
    const remainingCapacity = Math.max(0, MAX_XP - currentXp);
    if (remainingCapacity === 0) {
      return null;
    }
    const appliedDelta = Math.min(delta, remainingCapacity);
    return this.xpRepository.createIfAbsent({
      id: crypto.randomUUID(),
      userId,
      sourceType,
      sourceId,
      xpDelta: appliedDelta,
      eventId: sourceId,
      balanceType: 'ranking',
      balanceBefore: currentXp,
      balanceAfter: currentXp + appliedDelta,
      status: 'committed',
      city,
      country,
      createdAt: new Date(),
    });
  }

  async awardPoints({ userId, delta, sourceType, sourceId, city, country }) {
    if (delta <= 0) {
      return null;
    }
    // BR-002/BR-003: race-free idempotent wallet award. See awardXp above.
    const currentPoints = await this.getTotalPoints(userId);
    return this.pointsRepository.createIfAbsent({
      id: crypto.randomUUID(),
      userId,
      sourceType,
      sourceId,
      pointsDelta: delta,
      eventId: sourceId,
      balanceType: 'wallet',
      balanceBefore: currentPoints,
      balanceAfter: currentPoints + delta,
      status: 'committed',
      city,
      country,
      createdAt: new Date(),
    });
  }

  async adjustPoints({ userId, delta, sourceId, city, country }) {
    if (delta === 0) {
      return null;
    }
    const currentPoints = await this.getTotalPoints(userId);
    const appliedDelta = Math.max(delta, -currentPoints);
    if (appliedDelta === 0) {
      return null;
    }
    return this.pointsRepository.create({
      id: crypto.randomUUID(),
      userId,
      sourceType: ADMIN_ADJUSTMENT,
      sourceId,
      pointsDelta: appliedDelta,
      eventId: sourceId,
      balanceType: 'wallet',
      balanceBefore: currentPoints,
      balanceAfter: currentPoints + appliedDelta,
      status: 'committed',
      city,
      country,
      createdAt: new Date(),
    });
  }

  async deleteXpRecord(recordId) {
    return this.xpRepository.delete(recordId);
  }

  async deletePointsRecord(recordId) {
    return this.pointsRepository.delete(recordId);
  }
}
