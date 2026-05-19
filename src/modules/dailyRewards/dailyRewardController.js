import { messageResponse, successResponse } from '../../core/response.js';
import { requireBearerToken } from '../../shared/auth/authorization.js';
import { parsePagination } from '../../shared/pagination.js';
import {
  parseDailyRewardFilters,
  validateDailyRewardCreate,
  validateDailyRewardUpdate,
} from './dailyRewardValidators.js';

export function createDailyRewardController({ getDailyRewardService, config }) {
  async function service() {
    return getDailyRewardService(config);
  }

  return {
    async createDailyReward(req, res) {
      const data = await (await service()).createDailyReward({
        accessToken: requireBearerToken(req),
        payload: validateDailyRewardCreate(req.body),
        image: req.file ?? null,
      });
      res.status(201).json(successResponse(data));
    },
    async updateDailyReward(req, res) {
      const data = await (await service()).updateDailyReward({
        accessToken: requireBearerToken(req),
        rewardId: req.params.rewardId,
        payload: validateDailyRewardUpdate(req.body),
        image: req.file ?? null,
      });
      res.json(successResponse(data));
    },
    async listDailyRewards(req, res) {
      const { page, pageSize } = parsePagination(req.query);
      const data = await (await service()).listDailyRewards({
        accessToken: requireBearerToken(req),
        page,
        pageSize,
        ...parseDailyRewardFilters(req.query),
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
    async getDailyReward(req, res) {
      res.json(
        successResponse(
          await (await service()).getDailyReward({
            accessToken: requireBearerToken(req),
            rewardId: req.params.rewardId,
          }),
        ),
      );
    },
    async deleteDailyReward(req, res) {
      await (await service()).deleteDailyReward({
        accessToken: requireBearerToken(req),
        rewardId: req.params.rewardId,
      });
      res.json(messageResponse('Daily reward deleted successfully.'));
    },
  };
}
