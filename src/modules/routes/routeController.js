import { messageResponse, successResponse } from '../../core/response.js';
import { requireBearerToken } from '../../shared/auth/authorization.js';
import { parsePagination } from '../../shared/pagination.js';
import {
  parseRouteFilters,
  parseRouteAnalyticsQuery,
  parseRouteRestaurantSearch,
  validateRouteCreate,
  validateRouteUpdate,
} from './routeValidators.js';

export function createRouteController({ getRouteService, config }) {
  async function service() {
    return getRouteService(config);
  }

  return {
    async createRoute(req, res) {
      const data = await (await service()).createRoute({
        accessToken: requireBearerToken(req),
        payload: validateRouteCreate(req.body),
      });
      res.status(201).json(successResponse(data));
    },
    async listRoutes(req, res) {
      const { page, pageSize } = parsePagination(req.query);
      const data = await (await service()).listRoutes({
        accessToken: requireBearerToken(req),
        page,
        pageSize,
        ...parseRouteFilters(req.query),
      });
      res.json(successResponse(data));
    },
    async getAnalytics(req, res) {
      const data = await (await service()).getRouteAnalytics({
        accessToken: requireBearerToken(req),
        ...parseRouteAnalyticsQuery(req.query),
      });
      res.json(successResponse(data));
    },
    async getRoute(req, res) {
      const data = await (await service()).getRoute({
        accessToken: requireBearerToken(req),
        routeId: req.params.routeId,
      });
      res.json(successResponse(data));
    },
    async updateRoute(req, res) {
      const data = await (await service()).updateRoute({
        accessToken: requireBearerToken(req),
        routeId: req.params.routeId,
        payload: validateRouteUpdate(req.body),
      });
      res.json(successResponse(data));
    },
    async deleteRoute(req, res) {
      await (await service()).deleteRoute({
        accessToken: requireBearerToken(req),
        routeId: req.params.routeId,
      });
      res.json(messageResponse('Route deleted successfully.'));
    },
    async searchRestaurants(req, res) {
      const { page, pageSize } = parsePagination(req.query);
      const data = await (await service()).searchRestaurantsByCity({
        accessToken: requireBearerToken(req),
        page,
        pageSize,
        ...parseRouteRestaurantSearch(req.query),
      });
      res.json(successResponse(data));
    },
    async listMyRoutes(req, res) {
      const { page, pageSize } = parsePagination(req.query);
      const data = await (await service()).listMyRoutes({
        accessToken: requireBearerToken(req),
        page,
        pageSize,
        search: req.query.search ?? null,
      });
      res.json(successResponse(data));
    },
    async getMyRoute(req, res) {
      const data = await (await service()).getMyRoute({
        accessToken: requireBearerToken(req),
        routeId: req.params.routeId,
      });
      res.json(successResponse(data));
    },
  };
}
