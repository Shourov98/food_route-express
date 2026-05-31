import { Router } from 'express';

import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { multipartSingle } from '../../shared/http/multipart.js';
import { createRewardController } from './rewardController.js';
import { getRewardService } from './rewardDependencies.js';

export function createRewardRouter(config) {
  const router = Router();
  const controller = createRewardController({ getRewardService, config });
  const uploadImage = multipartSingle('image', {
    maxFileBytes: config.imageUploadMaxBytes,
  });

  router.post('/', uploadImage, asyncHandler(controller.createReward));
  router.patch('/:rewardId', uploadImage, asyncHandler(controller.updateReward));
  router.get('/', asyncHandler(controller.listRewards));
  router.get('/analytics', asyncHandler(controller.getAnalytics));
  router.get('/:rewardId', asyncHandler(controller.getReward));
  router.delete('/:rewardId', asyncHandler(controller.deleteReward));

  return router;
}

export function createUserRewardCatalogRouter(config) {
  const router = Router();
  const controller = createRewardController({ getRewardService, config });

  router.get('/', asyncHandler(controller.listAvailableRewards));

  return router;
}
