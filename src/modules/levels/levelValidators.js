import { validationError } from '../../core/ApplicationError.js';

function assertObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw validationError('Input should be a valid dictionary or object.');
  }
}

function optionalString(body, field, { min = 0, max = Infinity } = {}) {
  const value = body[field];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw validationError(`Field '${field}' should be a string.`);
  }
  if (value.length < min || value.length > max) {
    throw validationError(`Field '${field}' length is invalid.`);
  }
  return value;
}

function optionalInteger(body, field, { min = -Infinity, max = Infinity } = {}) {
  const value = body[field];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!Number.isInteger(value)) {
    throw validationError(`Field '${field}' should be an integer.`);
  }
  if (value < min || value > max) {
    throw validationError(`Field '${field}' is out of range.`);
  }
  return value;
}

export function validateLevelCreate(body) {
  assertObject(body);
  const name = optionalString(body, 'name', { min: 1, max: 120 });
  const minXp = optionalInteger(body, 'minXp', { min: 0, max: 30000 });
  if (name === undefined) {
    throw validationError("Field 'name' is required.");
  }
  if (minXp === undefined) {
    throw validationError("Field 'minXp' is required.");
  }
  return { name, minXp };
}

export function validateLevelUpdate(body) {
  assertObject(body);
  return {
    name: optionalString(body, 'name', { min: 1, max: 120 }),
    minXp: optionalInteger(body, 'minXp', { min: 0, max: 30000 }),
  };
}
