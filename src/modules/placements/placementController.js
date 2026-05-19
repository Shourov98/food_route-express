import { messageResponse, successResponse } from '../../core/response.js';
import { requireBearerToken } from '../../shared/auth/authorization.js';
import { validatePlacementAssign } from './placementValidators.js';

export function createPlacementController({ getPlacementService, config }) {
  async function service() {
    return getPlacementService(config);
  }

  return {
    async listByFeature(req, res) {
      const data = await (await service()).listByFeature({
        accessToken: requireBearerToken(req),
        feature: req.params.feature,
      });
      res.json(successResponse(data));
    },
    async listFeatures(req, res) {
      res.json(
        successResponse(
          await (await service()).listFeatures({ accessToken: requireBearerToken(req) }),
        ),
      );
    },
    async assign(req, res) {
      const data = await (await service()).assignPlacement({
        accessToken: requireBearerToken(req),
        payload: validatePlacementAssign(req.body),
      });
      res.json(successResponse(data));
    },
    async remove(req, res) {
      await (await service()).removePlacement({
        accessToken: requireBearerToken(req),
        placementId: req.params.placementId,
      });
      res.json(messageResponse('Placement removed successfully.'));
    },
    async toggle(req, res) {
      const data = await (await service()).togglePlacementStatus({
        accessToken: requireBearerToken(req),
        placementId: req.params.placementId,
      });
      res.json(successResponse(data));
    },
  };
}
