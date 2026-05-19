import { Router } from 'express';

import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { createPackageController } from './packageController.js';
import { getPackageService } from './packageDependencies.js';

export function createPackageRouter(config) {
  const router = Router();
  const controller = createPackageController({ getPackageService, config });

  router.get('/catalog', asyncHandler(controller.listCatalog));
  router.get('/features', asyncHandler(controller.listFeatures));
  router.post('/restaurants/:restaurantId/activate', asyncHandler(controller.activatePackage));
  router.post('/restaurants/:restaurantId/upgrade', asyncHandler(controller.upgradePackage));

  return router;
}
