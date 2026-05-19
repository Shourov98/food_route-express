import { Router } from 'express';

import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { createReviewController } from './reviewController.js';
import { getReviewService } from './reviewDependencies.js';

export function createReviewRouter(config) {
  const router = Router();
  const controller = createReviewController({ getReviewService, config });

  router.post('/:restaurantId/reviews', asyncHandler(controller.createReview));
  router.get('/:restaurantId/reviews', asyncHandler(controller.listReviews));
  router.patch('/:restaurantId/reviews/:reviewId', asyncHandler(controller.updateReview));
  router.delete('/:restaurantId/reviews/:reviewId', asyncHandler(controller.deleteReview));

  return router;
}
