import { Router } from 'express';
import multer from 'multer';

import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { createRewardController } from './rewardController.js';
import { getRewardService } from './rewardDependencies.js';

export function createRewardRouter(config) {
  const router = Router();
  const upload = multer();
  const controller = createRewardController({ getRewardService, config });

  router.post('/', upload.single('image'), asyncHandler(controller.createReward));
  router.patch('/:rewardId', upload.single('image'), asyncHandler(controller.updateReward));
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
