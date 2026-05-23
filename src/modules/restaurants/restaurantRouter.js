import { Router } from 'express';

import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { multipartSingle } from '../../shared/http/multipart.js';
import { createRestaurantController } from './restaurantController.js';
import { getRestaurantServices } from './restaurantDependencies.js';

export function createRestaurantRouter(config) {
  const router = Router();
  const controller = createRestaurantController({ getRestaurantServices, config });
  const uploadImage = multipartSingle('image', {
    maxFileBytes: config.imageUploadMaxBytes,
  });

  router.post('/', uploadImage, asyncHandler(controller.createRestaurant));
  router.put('/:restaurantId', uploadImage, asyncHandler(controller.updateRestaurant));
  router.get('/analytics/summary', asyncHandler(controller.listRestaurantAnalytics));
  router.get('/:restaurantId/analytics', asyncHandler(controller.getRestaurantAnalytics));
  router.get('/', asyncHandler(controller.listRestaurants));
  router.get('/:restaurantId', asyncHandler(controller.getRestaurant));
  router.delete('/:restaurantId', asyncHandler(controller.deleteRestaurant));

  router.get('/:restaurantId/menu', asyncHandler(controller.getMenu));
  router.post(
    '/:restaurantId/menu/items',
    uploadImage,
    asyncHandler(controller.createMenuItem),
  );
  router.patch(
    '/:restaurantId/menu/items/:itemId',
    uploadImage,
    asyncHandler(controller.updateMenuItem),
  );
  router.get('/:restaurantId/menu/items', asyncHandler(controller.listMenuItems));
  router.get('/:restaurantId/menu/items/:itemId', asyncHandler(controller.getMenuItem));
  router.delete('/:restaurantId/menu/items/:itemId', asyncHandler(controller.deleteMenuItem));

  return router;
}
