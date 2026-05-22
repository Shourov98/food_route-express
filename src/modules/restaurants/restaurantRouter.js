import { Router } from 'express';
import multer from 'multer';

import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { createRestaurantController } from './restaurantController.js';
import { getRestaurantServices } from './restaurantDependencies.js';

export function createRestaurantRouter(config) {
  const router = Router();
  const upload = multer();
  const controller = createRestaurantController({ getRestaurantServices, config });

<<<<<<< HEAD
  router.post('/', upload.single('image'), asyncHandler(controller.createRestaurant));
  router.put('/:restaurantId', upload.single('image'), asyncHandler(controller.updateRestaurant));
=======
  router.post('/', optionalSingleUpload('image'), asyncHandler(controller.createRestaurant));
  router.put('/:restaurantId', optionalSingleUpload('image'), asyncHandler(controller.updateRestaurant));
  router.get('/analytics/summary', asyncHandler(controller.listRestaurantAnalytics));
  router.get('/:restaurantId/analytics', asyncHandler(controller.getRestaurantAnalytics));
>>>>>>> 282f06c (feat: implement restaurant and route analytics endpoints, including check-in summaries and analytics queries)
  router.get('/', asyncHandler(controller.listRestaurants));
  router.get('/:restaurantId', asyncHandler(controller.getRestaurant));
  router.delete('/:restaurantId', asyncHandler(controller.deleteRestaurant));

  router.get('/:restaurantId/menu', asyncHandler(controller.getMenu));
  router.post(
    '/:restaurantId/menu/items',
    upload.single('image'),
    asyncHandler(controller.createMenuItem),
  );
  router.patch(
    '/:restaurantId/menu/items/:itemId',
    upload.single('image'),
    asyncHandler(controller.updateMenuItem),
  );
  router.get('/:restaurantId/menu/items', asyncHandler(controller.listMenuItems));
  router.get('/:restaurantId/menu/items/:itemId', asyncHandler(controller.getMenuItem));
  router.delete('/:restaurantId/menu/items/:itemId', asyncHandler(controller.deleteMenuItem));

  return router;
}
