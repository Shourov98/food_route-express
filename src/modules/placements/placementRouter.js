import { Router } from 'express';

import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { createPlacementController } from './placementController.js';
import { getPlacementService } from './placementDependencies.js';

export function createPlacementRouter(config) {
  const router = Router();
  const controller = createPlacementController({ getPlacementService, config });

  router.get('/features', asyncHandler(controller.listFeatures));
  router.get('/feature/:feature', asyncHandler(controller.listByFeature));
  router.post('/', asyncHandler(controller.assign));
  router.delete('/:placementId', asyncHandler(controller.remove));
  router.patch('/:placementId/toggle', asyncHandler(controller.toggle));

  return router;
}
