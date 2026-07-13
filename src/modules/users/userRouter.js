import { Router } from 'express';
import multer from 'multer';

import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { createUserController } from './userController.js';
import { getUserService } from './userDependencies.js';

export function createUserRouter(config) {
  const router = Router();
  const upload = multer();
  const controller = createUserController({ getUserService, config });

  router.get('/leaderboard', asyncHandler(controller.getLeaderboard));
  router.get('/me', asyncHandler(controller.getMe));
  router.get('/me/overview', asyncHandler(controller.getOverview));
  router.patch('/me', upload.single('image'), asyncHandler(controller.updateProfile));
  router.get('/me/referral', asyncHandler(controller.getReferral));
  router.get('/me/xp-summary', asyncHandler(controller.getXpSummary));
  router.get('/me/summary', asyncHandler(controller.getSummary));
  router.get('/me/points-summary', asyncHandler(controller.getPointsSummary));
  router.get('/me/proximity-settings', asyncHandler(controller.getProximitySettings));
  router.patch('/me/proximity-settings', asyncHandler(controller.updateProximitySettings));
  router.post('/me/proximity-scan', asyncHandler(controller.scanProximity));
  router.post('/me/push-token', asyncHandler(controller.registerPushToken));
  router.get('/me/share/check-ins/:checkinId/preview', asyncHandler(controller.getCheckinSharePreview));
  router.get('/me/share/rewards/:redemptionId/preview', asyncHandler(controller.getRewardSharePreview));
  router.get('/me/share/receipts/:receiptUploadId/preview', asyncHandler(controller.getReceiptSharePreview));
  router.post('/me/social-share-reward', asyncHandler(controller.claimSocialShareReward));
  router.get('/me/xp-history', asyncHandler(controller.getXpHistory));
  router.get('/me/streak', asyncHandler(controller.getStreak));
  router.get('/me/ranks', asyncHandler(controller.getRanks));
  router.patch('/me/image', upload.single('image'), asyncHandler(controller.uploadProfileImage));

  return router;
}
