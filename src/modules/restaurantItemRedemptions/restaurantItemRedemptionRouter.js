import { Router } from 'express';

import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { createRestaurantItemRedemptionController } from './restaurantItemRedemptionController.js';
import { getRestaurantItemRedemptionService } from './restaurantItemRedemptionDependencies.js';

export function createRestaurantItemRedemptionRouter(config) {
  const router = Router();
  const controller = createRestaurantItemRedemptionController({ getRestaurantItemRedemptionService, config });

  router.get('/', asyncHandler(controller.listRewardStore));
  router.get('/items', asyncHandler(controller.listItems));
  router.post('/items/:itemId/redeem', asyncHandler(controller.redeemItem));
  router.get('/history', asyncHandler(controller.listHistory));

  return router;
}

export function createRestaurantDishRouter(config) {
  const router = Router();
  const controller = createRestaurantItemRedemptionController({ getRestaurantItemRedemptionService, config });

  router.get('/', asyncHandler(controller.listDishes));
  router.post('/:itemId/buy', asyncHandler(controller.buyDish));

  return router;
}
