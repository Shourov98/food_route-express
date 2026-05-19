import { Router } from 'express';

import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { createSpinController } from './spinController.js';
import { getSpinService } from './spinDependencies.js';

export function createUserSpinRouter(config) {
  const router = Router();
  const controller = createSpinController({ getSpinService, config });

  router.get('/rewards', asyncHandler(controller.listRewards));
  router.post('/', asyncHandler(controller.spin));
  router.get('/history', asyncHandler(controller.history));

  return router;
}

export function createAdminSpinRouter(config) {
  const router = Router();
  const controller = createSpinController({ getSpinService, config });

  router.get('/analytics', asyncHandler(controller.analytics));
  router.get('/settings', asyncHandler(controller.settings));
  router.patch('/settings', asyncHandler(controller.updateSettings));

  return router;
}
