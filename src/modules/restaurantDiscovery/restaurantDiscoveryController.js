import { successResponse } from '../../core/response.js';
import { requireBearerToken } from '../../shared/auth/authorization.js';
import { parsePagination } from '../../shared/pagination.js';

export function createRestaurantDiscoveryController({ getRestaurantDiscoveryService, config }) {
  async function service() {
    return getRestaurantDiscoveryService(config);
  }

  return {
    async listRestaurants(req, res) {
      const { page, pageSize } = parsePagination(req.query);
      const discoveryService = await service();
      const { latitude, longitude } = discoveryService.parseLocation(req.query);
      res.json(successResponse(await discoveryService.listRestaurants({
        accessToken: requireBearerToken(req),
        page,
        pageSize,
        search: req.query.search,
        city: req.query.city,
        latitude,
        longitude,
      })));
    },
    async listFeaturedRestaurants(req, res) {
      const { page, pageSize } = parsePagination(req.query);
      const discoveryService = await service();
      const { latitude, longitude } = discoveryService.parseLocation(req.query);
      res.json(successResponse(await discoveryService.listFeaturedRestaurants({
        accessToken: requireBearerToken(req),
        page,
        pageSize,
        search: req.query.search,
        city: req.query.city,
        latitude,
        longitude,
      })));
    },
    async listNearbyRestaurants(req, res) {
      const { page, pageSize } = parsePagination(req.query);
      const discoveryService = await service();
      const { latitude, longitude } = discoveryService.parseLocation(req.query);
      res.json(successResponse(await discoveryService.listNearbyRestaurants({
        accessToken: requireBearerToken(req),
        page,
        pageSize,
        search: req.query.search,
        city: req.query.city,
        latitude,
        longitude,
      })));
    },
    async getRestaurant(req, res) {
      const discoveryService = await service();
      const { latitude, longitude } = discoveryService.parseLocation(req.query);
      res.json(successResponse(await discoveryService.getRestaurant({
        accessToken: requireBearerToken(req),
        restaurantId: req.params.restaurantId,
        latitude,
        longitude,
      })));
    },
    async getRestaurantMenu(req, res) {
      const discoveryService = await service();
      const { latitude, longitude } = discoveryService.parseLocation(req.query);
      res.json(successResponse(await discoveryService.getRestaurantMenu({
        accessToken: requireBearerToken(req),
        restaurantId: req.params.restaurantId,
        latitude,
        longitude,
      })));
    },
    async getDirections(req, res) {
      const discoveryService = await service();
      const { latitude, longitude } = discoveryService.parseLocation(req.query);
      res.json(successResponse(await discoveryService.getDirections({
        accessToken: requireBearerToken(req),
        restaurantId: req.params.restaurantId,
        latitude,
        longitude,
      })));
    },
  };
}
