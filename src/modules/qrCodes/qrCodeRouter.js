import { Router } from 'express';

import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { createQrCodeController } from './qrCodeController.js';
import { getQrCodeService } from './qrCodeDependencies.js';

export function createQrCodeRouter(config) {
  const router = Router();
  const controller = createQrCodeController({ getQrCodeService, config });

  router.get('/', asyncHandler(controller.list));
  router.get('/:restaurantId', asyncHandler(controller.details));
  router.get('/:restaurantId/image', asyncHandler(controller.image));
  router.get('/:restaurantId/pdf', asyncHandler(controller.pdf));

  return router;
}
