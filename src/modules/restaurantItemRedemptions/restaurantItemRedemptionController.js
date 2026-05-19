import { successResponse } from '../../core/response.js';
import { requireBearerToken } from '../../shared/auth/authorization.js';
import { parsePagination } from '../../shared/pagination.js';

export function createRestaurantItemRedemptionController({ getRestaurantItemRedemptionService, config }) {
  async function service() {
    return getRestaurantItemRedemptionService(config);
  }

  return {
    async listRewardStore(req, res) {
      const { page, pageSize } = parsePagination(req.query);
      res.json(successResponse(await (await service()).listRewardStore({
        accessToken: requireBearerToken(req),
        page,
        pageSize,
        search: req.query.search,
      })));
    },
    async listItems(req, res) {
      const { page, pageSize } = parsePagination(req.query);
      res.json(successResponse(await (await service()).listRedeemableItems({
        accessToken: requireBearerToken(req),
        page,
        pageSize,
        search: req.query.search,
      })));
    },
    async listDishes(req, res) {
      const items = await (await service()).listAllRedeemableItems({
        accessToken: requireBearerToken(req),
        search: req.query.search,
      });
      res.json(successResponse({ items }));
    },
    async redeemItem(req, res) {
      const data = await (await service()).redeemItem({
        accessToken: requireBearerToken(req),
        itemId: req.params.itemId,
      });
      res.status(201).json(successResponse(data));
    },
    async buyDish(req, res) {
      const data = await (await service()).redeemItem({
        accessToken: requireBearerToken(req),
        itemId: req.params.itemId,
      });
      res.status(201).json(successResponse(data));
    },
    async listHistory(req, res) {
      const { page, pageSize } = parsePagination(req.query);
      res.json(successResponse(await (await service()).listMyRedemptions({
        accessToken: requireBearerToken(req),
        page,
        pageSize,
      })));
    },
  };
}
