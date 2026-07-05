import { Router } from 'express';

import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { multipartSingle } from '../../shared/http/multipart.js';
import { createReceiptUploadController } from './receiptUploadController.js';
import { getReceiptUploadService } from './receiptUploadDependencies.js';

export function createReceiptUploadRouter(config) {
  const router = Router();
  const controller = createReceiptUploadController({ getReceiptUploadService, config });
  const uploadImage = multipartSingle('image', {
    maxFileBytes: config.imageUploadMaxBytes,
  });

  router.post('/:restaurantId/receipt', uploadImage, asyncHandler(controller.uploadReceipt));

  return router;
}
