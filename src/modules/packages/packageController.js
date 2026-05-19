import { successResponse } from '../../core/response.js';
import { requireBearerToken } from '../../shared/auth/authorization.js';
import { validateRestaurantPackageAction } from './packageValidators.js';

export function createPackageController({ getPackageService, config }) {
  async function service() {
    return getPackageService(config);
  }

  return {
    async listCatalog(req, res) {
      res.json(successResponse(await (await service()).listCatalog({
        accessToken: requireBearerToken(req),
      })));
    },
    async listFeatures(req, res) {
      res.json(successResponse(await (await service()).listFeatures({
        accessToken: requireBearerToken(req),
      })));
    },
    async activatePackage(req, res) {
      res.json(successResponse(await (await service()).activatePackage({
        accessToken: requireBearerToken(req),
        restaurantId: req.params.restaurantId,
        payload: validateRestaurantPackageAction(req.body),
      })));
    },
    async upgradePackage(req, res) {
      res.json(successResponse(await (await service()).upgradePackage({
        accessToken: requireBearerToken(req),
        restaurantId: req.params.restaurantId,
        payload: validateRestaurantPackageAction(req.body),
      })));
    },
  };
}
