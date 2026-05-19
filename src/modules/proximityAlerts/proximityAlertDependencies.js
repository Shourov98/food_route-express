import { getUserService } from '../users/userDependencies.js';

export function getInternalProximityAlertService(config) {
  return getUserService(config);
}
