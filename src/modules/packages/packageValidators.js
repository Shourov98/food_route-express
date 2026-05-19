import { validationError } from '../../core/ApplicationError.js';

const PACKAGES = new Set(['start', 'active', 'pro', 'prime', 'dominio']);

function assertObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw validationError('Input should be a valid dictionary or object.');
  }
}

export function validateRestaurantPackageAction(body) {
  assertObject(body);
  if (typeof body.package !== 'string' || !PACKAGES.has(body.package)) {
    throw validationError("Field 'package' is invalid.");
  }
  return { package: body.package };
}
