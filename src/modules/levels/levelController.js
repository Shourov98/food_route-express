import { messageResponse, successResponse } from '../../core/response.js';
import { requireBearerToken } from '../../shared/auth/authorization.js';
import { validateLevelCreate, validateLevelUpdate } from './levelValidators.js';

export function createLevelController({ getLevelService, config }) {
  async function service() {
    return getLevelService(config);
  }

  return {
    async listLevels(req, res) {
      res.json(successResponse(await (await service()).listLevels({
        accessToken: requireBearerToken(req),
      })));
    },
    async getConfig(req, res) {
      res.json(successResponse(await (await service()).getConfig({
        accessToken: requireBearerToken(req),
      })));
    },
    async createLevel(req, res) {
      res.status(201).json(successResponse(await (await service()).createLevel({
        accessToken: requireBearerToken(req),
        payload: validateLevelCreate(req.body),
      })));
    },
    async getLevel(req, res) {
      res.json(successResponse(await (await service()).getLevel({
        accessToken: requireBearerToken(req),
        levelId: req.params.levelId,
      })));
    },
    async updateLevel(req, res) {
      res.json(successResponse(await (await service()).updateLevel({
        accessToken: requireBearerToken(req),
        levelId: req.params.levelId,
        payload: validateLevelUpdate(req.body),
      })));
    },
    async deleteLevel(req, res) {
      await (await service()).deleteLevel({
        accessToken: requireBearerToken(req),
        levelId: req.params.levelId,
      });
      res.json(messageResponse('Level deleted successfully.'));
    },
  };
}
