import { Router } from 'express';

import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { createCheckInController } from './checkinController.js';
import { getCheckInService } from './checkinDependencies.js';

export function createCheckInRouter(config) {
  const router = Router();
  const controller = createCheckInController({ getCheckInService, config });

  router.post('/scan', asyncHandler(controller.scan));
  router.get('/history', asyncHandler(controller.userHistory));

  return router;
}

export function createAdminCheckInRouter(config) {
  const router = Router();
  const controller = createCheckInController({ getCheckInService, config });

  router.get('/', asyncHandler(controller.adminHistory));

  return router;
}
