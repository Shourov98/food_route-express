import { Router } from 'express';

import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { createSupportRequestController } from './supportRequestController.js';
import { getSupportRequestService } from './supportRequestDependencies.js';

export function createSupportRequestRouter(config) {
  const router = Router();
  const controller = createSupportRequestController({ getSupportRequestService, config });

  router.post('/', asyncHandler(controller.createSupportRequest));

  return router;
}

export function createAdminSupportRequestRouter(config) {
  const router = Router();
  const controller = createSupportRequestController({ getSupportRequestService, config });

  router.get('/', asyncHandler(controller.listSupportRequests));
  router.get('/:requestId', asyncHandler(controller.getSupportRequest));

  return router;
}
