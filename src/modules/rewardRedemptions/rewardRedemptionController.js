import { successResponse } from '../../core/response.js';
import { requireBearerToken } from '../../shared/auth/authorization.js';
import { parsePagination } from '../../shared/pagination.js';

export function createRewardRedemptionController({ getRewardRedemptionService, config }) {
  async function service() {
    return getRewardRedemptionService(config);
  }

  return {
    async redeemReward(req, res) {
      const data = await (await service()).redeemReward({
        accessToken: requireBearerToken(req),
        rewardId: req.params.rewardId,
      });
      res.status(201).json(successResponse(data));
    },
    async listMyRewards(req, res) {
      const { page, pageSize } = parsePagination(req.query);
      res.json(successResponse(await (await service()).listMyRewards({
        accessToken: requireBearerToken(req),
        page,
        pageSize,
        statusFilter: req.query.status,
      })));
    },
    async redeemOwnedReward(req, res) {
      res.json(successResponse(await (await service()).redeemOwnedReward({
        accessToken: requireBearerToken(req),
        redemptionId: req.params.redemptionId,
      })));
    },
  };
}
