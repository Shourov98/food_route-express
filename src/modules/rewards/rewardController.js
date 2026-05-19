import { messageResponse, successResponse } from '../../core/response.js';
import { requireBearerToken } from '../../shared/auth/authorization.js';
import { parsePagination } from '../../shared/pagination.js';
import { parseRewardFilters, validateRewardCreate, validateRewardUpdate } from './rewardValidators.js';

export function createRewardController({ getRewardService, config }) {
  async function service() {
    return getRewardService(config);
  }

  return {
    async createReward(req, res) {
      const data = await (await service()).createReward({
        accessToken: requireBearerToken(req),
        payload: validateRewardCreate(req.body),
        image: req.file ?? null,
      });
      res.status(201).json(successResponse(data));
    },
    async updateReward(req, res) {
      const data = await (await service()).updateReward({
        accessToken: requireBearerToken(req),
        rewardId: req.params.rewardId,
        payload: validateRewardUpdate(req.body),
        image: req.file ?? null,
      });
      res.json(successResponse(data));
    },
    async listRewards(req, res) {
      const { page, pageSize } = parsePagination(req.query);
      const data = await (await service()).listRewards({
        accessToken: requireBearerToken(req),
        page,
        pageSize,
        ...parseRewardFilters(req.query),
      });
      res.json(successResponse(data));
    },
    async listAvailableRewards(req, res) {
      const { page, pageSize } = parsePagination(req.query);
      const data = await (await service()).listAvailableRewards({
        accessToken: requireBearerToken(req),
        page,
        pageSize,
        ...parseRewardFilters(req.query),
      });
      res.json(successResponse(data));
    },
    async getAnalytics(req, res) {
      res.json(
        successResponse(
          await (await service()).getAnalytics({ accessToken: requireBearerToken(req) }),
        ),
      );
    },
    async getReward(req, res) {
      res.json(
        successResponse(
          await (await service()).getReward({
            accessToken: requireBearerToken(req),
            rewardId: req.params.rewardId,
          }),
        ),
      );
    },
    async deleteReward(req, res) {
      await (await service()).deleteReward({
        accessToken: requireBearerToken(req),
        rewardId: req.params.rewardId,
      });
      res.json(messageResponse('Reward deleted successfully.'));
    },
  };
}
