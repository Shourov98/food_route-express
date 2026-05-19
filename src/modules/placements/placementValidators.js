import { validationError } from '../../core/ApplicationError.js';

const FEATURES = new Set(['trending', 'featured', 'sponsored']);

function assertObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw validationError('Input should be a valid dictionary or object.');
  }
}

export function validatePlacementAssign(body) {
  assertObject(body);
  if (typeof body.feature !== 'string' || !FEATURES.has(body.feature)) {
    throw validationError("Field 'feature' is invalid.");
  }
  if (typeof body.restaurantId !== 'string' || body.restaurantId.length < 1) {
    throw validationError("Field 'restaurantId' is required.");
  }
  let sortOrder = 0;
  if (body.sortOrder !== undefined) {
    if (!Number.isInteger(body.sortOrder) || body.sortOrder < 0) {
      throw validationError("Field 'sortOrder' is out of range.");
    }
    sortOrder = body.sortOrder;
  }
  let active = true;
  if (body.active !== undefined) {
    if (typeof body.active !== 'boolean') {
      throw validationError("Field 'active' should be a boolean.");
    }
    active = body.active;
  }
  return {
    feature: body.feature,
    restaurantId: body.restaurantId,
    sortOrder,
    active,
  };
}
