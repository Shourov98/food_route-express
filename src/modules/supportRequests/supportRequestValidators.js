import { validationError } from '../../core/ApplicationError.js';

function assertObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw validationError('Input should be a valid dictionary or object.');
  }
}

function requiredString(body, field, { min = 0, max = Infinity } = {}) {
  const value = body[field];
  if (typeof value !== 'string') {
    throw validationError(`Field '${field}' is required.`);
  }
  if (value.length < min || value.length > max) {
    throw validationError(`Field '${field}' length is invalid.`);
  }
  return value;
}

export function validateSupportRequestCreate(body) {
  assertObject(body);
  return {
    title: requiredString(body, 'title', { min: 2, max: 120 }),
    message: requiredString(body, 'message', { min: 5, max: 5000 }),
  };
}
