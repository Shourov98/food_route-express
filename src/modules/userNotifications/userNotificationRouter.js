import { Router } from 'express';

import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { createUserNotificationController } from './userNotificationController.js';
import { getUserNotificationService } from './userNotificationDependencies.js';
import { getUserService } from '../users/userDependencies.js';

export function createUserNotificationRouter(config) {
  const router = Router();
  const controller = createUserNotificationController({
    getUserNotificationService,
    getUserService,
    config,
  });

  router.get('/', asyncHandler(controller.listNotifications));
  router.get('/preview', asyncHandler(controller.getPreview));
  router.get('/unread-count', asyncHandler(controller.getUnreadCount));
  router.post('/proximity/location', asyncHandler(controller.reportProximityLocation));
  router.post('/read-all', asyncHandler(controller.markAllRead));
  router.post('/:notificationId/read', asyncHandler(controller.markRead));

  return router;
}
