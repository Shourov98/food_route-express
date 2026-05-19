import { Router } from 'express';

import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { createInternalProximityAlertController } from './proximityAlertController.js';
import { getInternalProximityAlertService } from './proximityAlertDependencies.js';

export function createInternalProximityAlertRouter(config) {
  const router = Router();
  const controller = createInternalProximityAlertController({
    getInternalProximityAlertService,
    config,
  });

  router.post('/scan', asyncHandler(controller.scan));

  return router;
}
