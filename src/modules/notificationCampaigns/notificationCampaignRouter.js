import { Router } from 'express';

import { asyncHandler } from '../../shared/http/asyncHandler.js';
import {
  createNotificationCampaignController,
  notificationCampaignFormParser,
} from './notificationCampaignController.js';
import { getNotificationCampaignService } from './notificationCampaignDependencies.js';

export function createNotificationCampaignRouter(config) {
  const router = Router();
  const controller = createNotificationCampaignController({ getNotificationCampaignService, config });

  router.post('/', notificationCampaignFormParser(), asyncHandler(controller.createCampaign));
  router.patch('/:campaignId', notificationCampaignFormParser(), asyncHandler(controller.updateCampaign));
  router.get('/', asyncHandler(controller.listCampaigns));
  router.get('/:campaignId', asyncHandler(controller.getCampaign));
  router.delete('/:campaignId', asyncHandler(controller.deleteCampaign));

  return router;
}
