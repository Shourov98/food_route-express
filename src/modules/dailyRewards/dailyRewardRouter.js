import { Router } from 'express';
import multer from 'multer';

import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { createDailyRewardController } from './dailyRewardController.js';
import { getDailyRewardService } from './dailyRewardDependencies.js';

export function createDailyRewardRouter(config) {
  const router = Router();
  const upload = multer();
  const controller = createDailyRewardController({ getDailyRewardService, config });

  router.post('/', upload.single('image'), asyncHandler(controller.createDailyReward));
  router.patch('/:rewardId', upload.single('image'), asyncHandler(controller.updateDailyReward));
  router.get('/', asyncHandler(controller.listDailyRewards));
  router.get('/analytics', asyncHandler(controller.getAnalytics));
  router.get('/:rewardId', asyncHandler(controller.getDailyReward));
  router.delete('/:rewardId', asyncHandler(controller.deleteDailyReward));

  return router;
}
