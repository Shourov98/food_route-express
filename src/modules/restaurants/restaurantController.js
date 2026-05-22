import { messageResponse, successResponse } from '../../core/response.js';
import { requireBearerToken } from '../../shared/auth/authorization.js';
import {
  validateMenuItemCreate,
  validateMenuItemUpdate,
  parseRestaurantAnalyticsQuery,
  validateRestaurantCreate,
  validateRestaurantUpdate,
} from './restaurantValidators.js';

export function createRestaurantController({ getRestaurantServices, config }) {
  async function services() {
    return getRestaurantServices(config);
  }

  return {
    async createRestaurant(req, res) {
      const { restaurantService } = await services();
      const data = await restaurantService.createRestaurant({
        accessToken: requireBearerToken(req),
        payload: validateRestaurantCreate(req.body, req.file),
        image: req.file,
      });
      res.status(201).json(successResponse(data));
    },

    async updateRestaurant(req, res) {
      const { restaurantService } = await services();
      const data = await restaurantService.updateRestaurant({
        accessToken: requireBearerToken(req),
        restaurantId: req.params.restaurantId,
        payload: validateRestaurantUpdate(req.body),
        image: req.file ?? null,
      });
      res.json(successResponse(data));
    },

    async listRestaurants(req, res) {
      const { restaurantService } = await services();
      res.json(
        successResponse(
          await restaurantService.listRestaurants({ accessToken: requireBearerToken(req) }),
        ),
      );
    },

    async listRestaurantAnalytics(req, res) {
      const { restaurantService } = await services();
      res.json(
        successResponse(
          await restaurantService.listRestaurantAnalytics({
            accessToken: requireBearerToken(req),
            ...parseRestaurantAnalyticsQuery(req.query),
          }),
        ),
      );
    },

    async getRestaurantAnalytics(req, res) {
      const { restaurantService } = await services();
      res.json(
        successResponse(
          await restaurantService.getRestaurantAnalytics({
            accessToken: requireBearerToken(req),
            restaurantId: req.params.restaurantId,
            ...parseRestaurantAnalyticsQuery(req.query),
          }),
        ),
      );
    },

    async getRestaurant(req, res) {
      const { restaurantService } = await services();
      res.json(
        successResponse(
          await restaurantService.getRestaurant({
            accessToken: requireBearerToken(req),
            restaurantId: req.params.restaurantId,
          }),
        ),
      );
    },

    async deleteRestaurant(req, res) {
      const { restaurantService } = await services();
      await restaurantService.deleteRestaurant({
        accessToken: requireBearerToken(req),
        restaurantId: req.params.restaurantId,
      });
      res.json(messageResponse('Restaurant deleted successfully.'));
    },

    async getMenu(req, res) {
      const { menuService } = await services();
      res.json(
        successResponse(
          await menuService.getMenu({
            accessToken: requireBearerToken(req),
            restaurantId: req.params.restaurantId,
          }),
        ),
      );
    },

    async createMenuItem(req, res) {
      const { menuService } = await services();
      const data = await menuService.createMenuItem({
        accessToken: requireBearerToken(req),
        restaurantId: req.params.restaurantId,
        payload: validateMenuItemCreate(req.body),
        image: req.file ?? null,
      });
      res.status(201).json(successResponse(data));
    },

    async updateMenuItem(req, res) {
      const { menuService } = await services();
      const data = await menuService.updateMenuItem({
        accessToken: requireBearerToken(req),
        restaurantId: req.params.restaurantId,
        itemId: req.params.itemId,
        payload: validateMenuItemUpdate(req.body),
        image: req.file ?? null,
      });
      res.json(successResponse(data));
    },

    async listMenuItems(req, res) {
      const { menuService } = await services();
      res.json(
        successResponse({
          items: await menuService.listMenuItems({
            accessToken: requireBearerToken(req),
            restaurantId: req.params.restaurantId,
          }),
        }),
      );
    },

    async getMenuItem(req, res) {
      const { menuService } = await services();
      res.json(
        successResponse(
          await menuService.getMenuItem({
            accessToken: requireBearerToken(req),
            restaurantId: req.params.restaurantId,
            itemId: req.params.itemId,
          }),
        ),
      );
    },

    async deleteMenuItem(req, res) {
      const { menuService } = await services();
      await menuService.deleteMenuItem({
        accessToken: requireBearerToken(req),
        restaurantId: req.params.restaurantId,
        itemId: req.params.itemId,
      });
      res.json(messageResponse('Menu item deleted successfully.'));
    },
  };
}
