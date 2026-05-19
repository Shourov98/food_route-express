import { messageResponse, successResponse } from '../../core/response.js';
import { requireBearerToken } from '../../shared/auth/authorization.js';
import { parsePagination } from '../../shared/pagination.js';
import { parseFavoriteFilters } from './favoriteValidators.js';

export function createFavoriteController({ getFavoriteService, config }) {
  async function service() {
    return getFavoriteService(config);
  }

  return {
    async listFavoriteRestaurants(req, res) {
      const { page, pageSize } = parsePagination(req.query);
      const data = await (await service()).listFavoriteRestaurants({
        accessToken: requireBearerToken(req),
        page,
        pageSize,
        ...parseFavoriteFilters(req.query),
      });
      res.json(successResponse(data));
    },
    async toggleFavoriteRestaurant(req, res) {
      const isFavorite = await (await service()).toggleFavoriteRestaurant({
        accessToken: requireBearerToken(req),
        restaurantId: req.params.restaurantId,
      });
      res.json(
        messageResponse(
          isFavorite
            ? 'Restaurant added to favorites successfully.'
            : 'Restaurant removed from favorites successfully.',
        ),
      );
    },
  };
}
