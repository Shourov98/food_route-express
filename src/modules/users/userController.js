import { successResponse } from '../../core/response.js';
import { validationError } from '../../core/ApplicationError.js';
import { requireBearerToken } from '../../shared/auth/authorization.js';
import { parsePagination } from '../../shared/pagination.js';
import {
  validateProfileUpdate,
  validateProximitySettings,
  validateProximityScan,
  validatePushToken,
  validateSocialShare,
} from './userValidators.js';

export function createUserController({ getUserService, config }) {
  async function service() {
    return getUserService(config);
  }

  return {
    async getLeaderboard(req, res) {
      const { page, pageSize } = parsePagination(req.query);
      const scope = String(req.query.scope ?? '').toLowerCase();
      const period = String(req.query.period ?? '').toLowerCase();
      if (!new Set(['local', 'national', 'worldwide']).has(scope)) {
        throw validationError("Query param 'scope' must be 'local', 'national', or 'worldwide'.");
      }
      if (!new Set(['weekly', 'monthly', 'all_time']).has(period)) {
        throw validationError("Query param 'period' must be 'weekly', 'monthly', or 'all_time'.");
      }
      res.json(successResponse(await (await service()).getLeaderboard({
        accessToken: requireBearerToken(req),
        page,
        pageSize,
        scope,
        period,
      })));
    },
    async getMe(req, res) {
      res.json(successResponse(await (await service()).getMe({ accessToken: requireBearerToken(req) })));
    },
    async getOverview(req, res) {
      res.json(successResponse(await (await service()).getOverview({ accessToken: requireBearerToken(req) })));
    },
    async updateProfile(req, res) {
      const data = await (await service()).updateProfile({
        accessToken: requireBearerToken(req),
        payload: validateProfileUpdate(req.body),
      });
      res.json(successResponse(data));
    },
    async getReferral(req, res) {
      res.json(successResponse(await (await service()).getReferralSummary({ accessToken: requireBearerToken(req) })));
    },
    async getXpSummary(req, res) {
      res.json(successResponse(await (await service()).getXpSummary({ accessToken: requireBearerToken(req) })));
    },
    async getSummary(req, res) {
      res.json(successResponse(await (await service()).getSummary({ accessToken: requireBearerToken(req) })));
    },
    async getPointsSummary(req, res) {
      res.json(successResponse(await (await service()).getPointsSummary({ accessToken: requireBearerToken(req) })));
    },
    async getProximitySettings(req, res) {
      const data = await (await service()).getProximitySettings({ accessToken: requireBearerToken(req) });
      res.json(successResponse({ settings: data, triggeredAlerts: [] }));
    },
    async updateProximitySettings(req, res) {
      const data = await (await service()).updateProximitySettings({
        accessToken: requireBearerToken(req),
        payload: validateProximitySettings(req.body),
      });
      res.json(successResponse(data));
    },
    async scanProximity(req, res) {
      const payload = validateProximityScan(req.body);
      res.json(successResponse(await (await service()).scanProximityAlerts({ accessToken: requireBearerToken(req), payload })));
    },
    async registerPushToken(req, res) {
      const data = await (await service()).registerPushToken({
        accessToken: requireBearerToken(req),
        payload: validatePushToken(req.body),
      });
      res.json(successResponse(data, 'Push token registered successfully.'));
    },
    async claimSocialShareReward(req, res) {
      const data = await (await service()).claimSocialShareReward({
        accessToken: requireBearerToken(req),
        payload: validateSocialShare(req.body),
      });
      const shareLabel = data.shareType === 'checkin' ? 'check-in' : 'reward';
      res.json(
        successResponse(
          data,
          data.awarded
            ? `Social share reward granted successfully for this ${shareLabel}.`
            : `Social share reward has already been claimed for this ${shareLabel}.`,
        ),
      );
    },
    async getCheckinSharePreview(req, res) {
      res.json(successResponse(await (await service()).getCheckinSharePreview({
        accessToken: requireBearerToken(req),
        checkinId: req.params.checkinId,
      })));
    },
    async getRewardSharePreview(req, res) {
      res.json(successResponse(await (await service()).getRewardSharePreview({
        accessToken: requireBearerToken(req),
        redemptionId: req.params.redemptionId,
      })));
    },
    async getReceiptSharePreview(req, res) {
      res.json(successResponse(await (await service()).getReceiptSharePreview({
        accessToken: requireBearerToken(req),
        receiptUploadId: req.params.receiptUploadId,
      })));
    },
    async getXpHistory(req, res) {
      const { page, pageSize } = parsePagination(req.query);
      res.json(successResponse(await (await service()).getXpHistory({
        accessToken: requireBearerToken(req),
        page,
        pageSize,
      })));
    },
    async getStreak(req, res) {
      res.json(successResponse(await (await service()).getStreak({ accessToken: requireBearerToken(req) })));
    },
    async getRanks(req, res) {
      const scopeRaw = req.query.scope == null ? null : String(req.query.scope).toLowerCase();
      let scope = null;
      if (scopeRaw != null && scopeRaw !== '' && scopeRaw !== 'all') {
        if (!new Set(['local', 'national', 'worldwide']).has(scopeRaw)) {
          throw validationError("Query param 'scope' must be 'local', 'national', or 'worldwide'.");
        }
        scope = scopeRaw;
      }
      res.json(successResponse(await (await service()).getRanks({
        accessToken: requireBearerToken(req),
        scope,
      })));
    },
    async uploadProfileImage(req, res) {
      const data = await (await service()).uploadProfileImage({
        accessToken: requireBearerToken(req),
        image: req.file,
      });
      res.json(successResponse(data));
    },
  };
}
