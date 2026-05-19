import { ApplicationError } from '../../core/ApplicationError.js';
import { successResponse } from '../../core/response.js';

export function createInternalProximityAlertController({ getInternalProximityAlertService, config }) {
  async function service() {
    return getInternalProximityAlertService(config);
  }

  return {
    async scan(req, res) {
      const expected = config.internalJobsSecret;
      const provided = req.headers['x-internal-job-secret'];
      if (!expected || provided !== expected) {
        throw new ApplicationError({
          code: 'forbidden',
          message: 'Invalid internal job secret.',
          statusCode: 403,
        });
      }
      res.json(successResponse(await (await service()).scanAllProximityAlerts()));
    },
  };
}
