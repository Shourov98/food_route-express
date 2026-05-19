import { successResponse } from '../../core/response.js';
import { requireBearerToken } from '../../shared/auth/authorization.js';
import { parsePagination } from '../../shared/pagination.js';
import { validateSpinSettingsUpdate } from './spinValidators.js';

export function createSpinController({ getSpinService, config }) {
  async function service() {
    return getSpinService(config);
  }

  return {
    async listRewards(req, res) {
      res.json(
        successResponse(
          await (await service()).listSpinRewards({ accessToken: requireBearerToken(req) }),
        ),
      );
    },
    async spin(req, res) {
      const data = await (await service()).spin({ accessToken: requireBearerToken(req) });
      res.status(201).json(successResponse(data));
    },
    async history(req, res) {
      const { page, pageSize } = parsePagination(req.query);
      res.json(
        successResponse(
          await (await service()).listHistory({
            accessToken: requireBearerToken(req),
            page,
            pageSize,
          }),
        ),
      );
    },
    async analytics(req, res) {
      res.json(
        successResponse(
          await (await service()).getAdminAnalytics({ accessToken: requireBearerToken(req) }),
        ),
      );
    },
    async settings(req, res) {
      res.json(
        successResponse(
          await (await service()).getAdminSettings({ accessToken: requireBearerToken(req) }),
        ),
      );
    },
    async updateSettings(req, res) {
      res.json(
        successResponse(
          await (await service()).updateAdminSettings({
            accessToken: requireBearerToken(req),
            payload: validateSpinSettingsUpdate(req.body),
          }),
        ),
      );
    },
  };
}
