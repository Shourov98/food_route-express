import { ApplicationError } from '../../core/ApplicationError.js';
import { getAuthenticatedAccount, requireActiveRoles } from '../../shared/auth/authorization.js';
import { buildLevelRecordId } from './levelRepository.js';

const DEFAULT_MAX_XP = 30000;
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

export class LevelService {
  constructor({ levelRepository, userRepository, identityProvider }) {
    this.levelRepository = levelRepository;
    this.userRepository = userRepository;
    this.identityProvider = identityProvider;
  }

  async listLevels({ accessToken }) {
    await this.getCurrentAdmin(accessToken);
    return { items: await this.ensureLevels() };
  }

  async getConfig({ accessToken }) {
    await this.getCurrentAdmin(accessToken);
    return {
      maxXp: DEFAULT_MAX_XP,
      items: await this.ensureLevels(),
    };
  }

  async createLevel({ accessToken, payload }) {
    await this.getCurrentAdmin(accessToken);
    await this.ensureUniqueMinXp(payload.minXp);
    const now = new Date();
    const record = {
      id: buildLevelRecordId(),
      name: payload.name,
      minXp: payload.minXp,
      createdAt: now,
      updatedAt: now,
    };
    await this.levelRepository.create(record);
    return record;
  }

  async getLevel({ accessToken, levelId }) {
    await this.getCurrentAdmin(accessToken);
    return this.getLevelOrError(levelId);
  }

  async updateLevel({ accessToken, levelId, payload }) {
    await this.getCurrentAdmin(accessToken);
    const existing = await this.getLevelOrError(levelId);
    const nextMinXp = payload.minXp ?? existing.minXp;
    if (nextMinXp !== existing.minXp) {
      await this.ensureUniqueMinXp(nextMinXp, { excludeLevelId: levelId });
    }
    const updated = {
      ...existing,
      name: payload.name ?? existing.name,
      minXp: nextMinXp,
      updatedAt: new Date(),
    };
    await this.levelRepository.update(levelId, updated);
    return updated;
  }

  async deleteLevel({ accessToken, levelId }) {
    await this.getCurrentAdmin(accessToken);
    const levels = await this.ensureLevels();
    if (levels.length <= 1) {
      throw new ApplicationError({
        code: 'level_delete_conflict',
        message: 'At least one level must remain configured.',
        statusCode: 409,
      });
    }
    const deleted = await this.levelRepository.delete(levelId);
    if (!deleted) {
      throw new ApplicationError({
        code: 'level_not_found',
        message: 'No level found for the provided identifier.',
        statusCode: 404,
      });
    }
  }

  async ensureLevels() {
    const levels = await this.levelRepository.listAll();
    if (levels.length) {
      return levels;
    }
    const now = new Date();
    const defaults = DEFAULT_LEVELS.map((level) => ({
      id: buildLevelRecordId(),
      name: level.name,
      minXp: level.minXp,
      createdAt: now,
      updatedAt: now,
    }));
    for (const record of defaults) {
      await this.levelRepository.create(record);
    }
    return defaults;
  }

  async ensureUniqueMinXp(minXp, { excludeLevelId = null } = {}) {
    const levels = await this.levelRepository.listAll();
    for (const level of levels) {
      if (excludeLevelId && level.id === excludeLevelId) {
        continue;
      }
      if (level.minXp === minXp) {
        throw new ApplicationError({
          code: 'level_min_xp_conflict',
          message: 'Another level already uses this XP threshold.',
          statusCode: 409,
        });
      }
    }
  }

  async getLevelOrError(levelId) {
    const record = await this.levelRepository.getById(levelId);
    if (!record) {
      throw new ApplicationError({
        code: 'level_not_found',
        message: 'No level found for the provided identifier.',
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
}
