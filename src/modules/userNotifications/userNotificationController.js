import { messageResponse, successResponse } from '../../core/response.js';
import { requireBearerToken } from '../../shared/auth/authorization.js';
import { parsePagination } from '../../shared/pagination.js';
import { parseNotificationListQuery } from './userNotificationValidators.js';

export function createUserNotificationController({ getUserNotificationService, config }) {
  async function service() {
    return getUserNotificationService(config);
  }

  return {
    async listNotifications(req, res) {
      const { page, pageSize } = parsePagination(req.query);
      const { category } = parseNotificationListQuery(req.query);
      const data = await (await service()).listNotifications({
        accessToken: requireBearerToken(req),
        page,
        pageSize,
        category,
      });
      res.json(successResponse(data));
    },
    async getPreview(req, res) {
      const { limit } = parseNotificationListQuery(req.query);
      const data = await (await service()).getPreview({
        accessToken: requireBearerToken(req),
        limit,
      });
      res.json(successResponse(data));
    },
    async getUnreadCount(req, res) {
      const data = await (await service()).getUnreadCount({
        accessToken: requireBearerToken(req),
      });
      res.json(successResponse(data));
    },
    async markRead(req, res) {
      await (await service()).markRead({
        accessToken: requireBearerToken(req),
        notificationId: req.params.notificationId,
      });
      res.json(messageResponse('Notification marked as read.'));
    },
    async markAllRead(req, res) {
      await (await service()).markAllRead({
        accessToken: requireBearerToken(req),
      });
      res.json(messageResponse('All notifications marked as read.'));
    },
  };
}
