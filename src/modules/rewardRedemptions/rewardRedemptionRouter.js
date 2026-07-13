import { Router } from 'express';

import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { createRewardRedemptionController } from './rewardRedemptionController.js';
import { getRewardRedemptionService } from './rewardRedemptionDependencies.js';

export function createRewardRedemptionRouter(config) {
  const router = Router();
  const controller = createRewardRedemptionController({ getRewardRedemptionService, config });

  router.post('/:rewardId/redeem', asyncHandler(controller.redeemReward));

  return router;
}

export function createUserRewardRedemptionRouter(config) {
  const router = Router();
  const controller = createRewardRedemptionController({ getRewardRedemptionService, config });

  router.get('/', asyncHandler(controller.listMyRewards));
  router.post('/:redemptionId/redeem', asyncHandler(controller.redeemOwnedReward));

  return router;
}

export function createAdminRewardRedemptionRouter(config) {
  const router = Router();
  const controller = createRewardRedemptionController({ getRewardRedemptionService, config });

  router.get('/', asyncHandler(controller.listAdminRedemptions));
  router.patch('/:redemptionId/status', asyncHandler(controller.updateAdminRedemptionStatus));

  return router;
}
