import { successResponse } from '../../core/response.js';
import { requireBearerToken } from '../../shared/auth/authorization.js';
import { parsePagination } from '../../shared/pagination.js';
import { validateCheckInScan } from './checkinValidators.js';

export function createCheckInController({ getCheckInService, config }) {
  async function service() {
    return getCheckInService(config);
  }

  return {
    async scan(req, res) {
      const result = await (await service()).scanQr({
        accessToken: requireBearerToken(req),
        qrToken: validateCheckInScan(req.body).qrToken,
      });
      res.status(201).json(successResponse(result.data, result.message));
    },
    async userHistory(req, res) {
      const { page, pageSize } = parsePagination(req.query);
      res.json(
        successResponse(
          await (await service()).listUserCheckins({
            accessToken: requireBearerToken(req),
            page,
            pageSize,
          }),
        ),
      );
    },
    async adminHistory(req, res) {
      const { page, pageSize } = parsePagination(req.query);
      res.json(
        successResponse(
          await (await service()).listAdminCheckins({
            accessToken: requireBearerToken(req),
            page,
            pageSize,
          }),
        ),
      );
    },
  };
}
