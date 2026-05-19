import multer from 'multer';

import { messageResponse, successResponse } from '../../core/response.js';
import { requireBearerToken } from '../../shared/auth/authorization.js';
import { parsePagination } from '../../shared/pagination.js';
import {
  parseNotificationCampaignFilters,
  validateNotificationCampaignCreate,
  validateNotificationCampaignUpdate,
} from './notificationCampaignValidators.js';

const upload = multer();

export function notificationCampaignFormParser() {
  return upload.none();
}

export function createNotificationCampaignController({ getNotificationCampaignService, config }) {
  async function service() {
    return getNotificationCampaignService(config);
  }

  return {
    async createCampaign(req, res) {
      const data = await (await service()).createCampaign({
        accessToken: requireBearerToken(req),
        payload: validateNotificationCampaignCreate(req.body),
      });
      res.status(201).json(successResponse(data));
    },
    async updateCampaign(req, res) {
      const data = await (await service()).updateCampaign({
        accessToken: requireBearerToken(req),
        campaignId: req.params.campaignId,
        payload: validateNotificationCampaignUpdate(req.body),
      });
      res.json(successResponse(data));
    },
    async listCampaigns(req, res) {
      const { page, pageSize } = parsePagination(req.query);
      const data = await (await service()).listCampaigns({
        accessToken: requireBearerToken(req),
        page,
        pageSize,
        ...parseNotificationCampaignFilters(req.query),
      });
      res.json(successResponse(data));
    },
    async getCampaign(req, res) {
      const data = await (await service()).getCampaign({
        accessToken: requireBearerToken(req),
        campaignId: req.params.campaignId,
      });
      res.json(successResponse(data));
    },
    async deleteCampaign(req, res) {
      await (await service()).deleteCampaign({
        accessToken: requireBearerToken(req),
        campaignId: req.params.campaignId,
      });
      res.json(messageResponse('Notification campaign deleted successfully.'));
    },
  };
}
