import { messageResponse, successResponse } from '../../core/response.js';
import { requireBearerToken } from '../../shared/auth/authorization.js';
import { parsePagination } from '../../shared/pagination.js';
import { validateProximityScan } from '../users/userValidators.js';
import { parseNotificationListQuery } from './userNotificationValidators.js';

export function createUserNotificationController({
  getUserNotificationService,
  getUserService,
  config,
}) {
  async function notificationService() {
    return getUserNotificationService(config);
  }

  async function userService() {
    return getUserService(config);
  }

  return {
    async listNotifications(req, res) {
      const { page, pageSize } = parsePagination(req.query);
      const { category } = parseNotificationListQuery(req.query);
      const data = await (await notificationService()).listNotifications({
        accessToken: requireBearerToken(req),
        page,
        pageSize,
        category,
      });
      res.json(successResponse(data));
    },
    async getPreview(req, res) {
      const { limit } = parseNotificationListQuery(req.query);
      const data = await (await notificationService()).getPreview({
        accessToken: requireBearerToken(req),
        limit,
      });
      res.json(successResponse(data));
    },
    async getUnreadCount(req, res) {
      const data = await (await notificationService()).getUnreadCount({
        accessToken: requireBearerToken(req),
      });
      res.json(successResponse(data));
    },
    async markRead(req, res) {
      await (await notificationService()).markRead({
        accessToken: requireBearerToken(req),
        notificationId: req.params.notificationId,
      });
      res.json(messageResponse('Notification marked as read.'));
    },
    async markAllRead(req, res) {
      await (await notificationService()).markAllRead({
        accessToken: requireBearerToken(req),
      });
      res.json(messageResponse('All notifications marked as read.'));
    },
    async reportProximityLocation(req, res) {
      const payload = validateProximityScan(req.body);
      const data = await (await userService()).reportProximityLocation({
        accessToken: requireBearerToken(req),
        payload,
      });
      res.json(successResponse(data));
    },
  };
}
