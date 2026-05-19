import { Router } from 'express';

import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { createRestaurantDiscoveryController } from './restaurantDiscoveryController.js';
import { getRestaurantDiscoveryService } from './restaurantDiscoveryDependencies.js';

export function createRestaurantDiscoveryRouter(config) {
  const router = Router();
  const controller = createRestaurantDiscoveryController({ getRestaurantDiscoveryService, config });

  router.get('/featured', asyncHandler(controller.listFeaturedRestaurants));
  router.get('/nearby', asyncHandler(controller.listNearbyRestaurants));
  router.get('/:restaurantId/menu', asyncHandler(controller.getRestaurantMenu));
  router.get('/:restaurantId/directions', asyncHandler(controller.getDirections));
  router.get('/:restaurantId', asyncHandler(controller.getRestaurant));
  router.get('/', asyncHandler(controller.listRestaurants));

  return router;
}
