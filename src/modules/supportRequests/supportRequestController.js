import { successResponse } from '../../core/response.js';
import { requireBearerToken } from '../../shared/auth/authorization.js';
import { parsePagination } from '../../shared/pagination.js';
import { validateSupportRequestCreate } from './supportRequestValidators.js';

export function createSupportRequestController({ getSupportRequestService, config }) {
  async function service() {
    return getSupportRequestService(config);
  }

  return {
    async createSupportRequest(req, res) {
      const data = await (await service()).createSupportRequest({
        accessToken: requireBearerToken(req),
        payload: validateSupportRequestCreate(req.body),
      });
      res.json(successResponse(data));
    },
    async listSupportRequests(req, res) {
      const { page, pageSize } = parsePagination(req.query);
      const data = await (await service()).listSupportRequests({
        accessToken: requireBearerToken(req),
        page,
        pageSize,
      });
      res.json(successResponse(data));
    },
    async getSupportRequest(req, res) {
      const data = await (await service()).getSupportRequest({
        accessToken: requireBearerToken(req),
        requestId: req.params.requestId,
      });
      res.json(successResponse(data));
    },
  };
}
