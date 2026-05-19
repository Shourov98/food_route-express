import { validationError } from '../../core/ApplicationError.js';

export function validateSpinSettingsUpdate(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw validationError('Input should be a valid dictionary or object.');
  }
  if (!new Set(['daily', 'manual']).has(body.resetLogic)) {
    throw validationError("Field 'resetLogic' is invalid.");
  }
  if (typeof body.resetTimeUtc !== 'string' || body.resetTimeUtc.length === 0) {
    throw validationError("Field 'resetTimeUtc' is required.");
  }
  if (body.noRewardProbability !== undefined && body.noRewardProbability !== null) {
    if (!Number.isInteger(body.noRewardProbability)) {
      throw validationError("Field 'noRewardProbability' should be an integer.");
    }
    if (body.noRewardProbability < 0 || body.noRewardProbability > 100) {
      throw validationError("Field 'noRewardProbability' is out of range.");
    }
  }
  return {
    resetLogic: body.resetLogic,
    resetTimeUtc: body.resetTimeUtc,
    noRewardProbability: body.noRewardProbability ?? null,
  };
}
