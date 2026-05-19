import { Router } from 'express';

import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { createFavoriteController } from './favoriteController.js';
import { getFavoriteService } from './favoriteDependencies.js';

export function createFavoriteRouter(config) {
  const router = Router();
  const controller = createFavoriteController({ getFavoriteService, config });

  router.get('/restaurants', asyncHandler(controller.listFavoriteRestaurants));
  router.patch('/restaurants/:restaurantId', asyncHandler(controller.toggleFavoriteRestaurant));

  return router;
}
