import { Router } from 'express';

import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { createRouteController } from './routeController.js';
import { getRouteService } from './routeDependencies.js';

export function createAdminRouteRouter(config) {
  const router = Router();
  const controller = createRouteController({ getRouteService, config });

  router.post('/', asyncHandler(controller.createRoute));
  router.get('/restaurants/search', asyncHandler(controller.searchRestaurants));
  router.get('/analytics', asyncHandler(controller.getAnalytics));
  router.get('/', asyncHandler(controller.listRoutes));
  router.get('/:routeId', asyncHandler(controller.getRoute));
  router.patch('/:routeId', asyncHandler(controller.updateRoute));
  router.delete('/:routeId', asyncHandler(controller.deleteRoute));

  return router;
}

export function createUserRouteRouter(config) {
  const router = Router();
  const controller = createRouteController({ getRouteService, config });

  router.get('/', asyncHandler(controller.listMyRoutes));
  router.get('/:routeId', asyncHandler(controller.getMyRoute));

  return router;
}
