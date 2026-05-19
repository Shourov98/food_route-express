import { validationError } from '../../core/ApplicationError.js';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function assertObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw validationError('Input should be a valid dictionary or object.');
  }
}

function optionalString(body, field, { min = 0, max = Infinity, pattern } = {}) {
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
  if (pattern && !pattern.test(value)) {
    throw validationError(`Field '${field}' is invalid.`);
  }
  return value;
}

function requiredString(body, field, options) {
  const value = optionalString(body, field, options);
  if (value === undefined) {
    throw validationError(`Field '${field}' is required.`);
  }
  return value;
}

export function validateCmsUpsert(body) {
  assertObject(body);
  return {
    title: optionalString(body, 'title', { min: 2, max: 120 }),
    content: optionalString(body, 'content', { max: 200_000 }) ?? '',
  };
}

export function validateCmsCreate(body) {
  assertObject(body);
  return {
    slug: requiredString(body, 'slug', { min: 2, max: 120, pattern: SLUG_RE }),
    title: requiredString(body, 'title', { min: 2, max: 120 }),
    content: optionalString(body, 'content', { max: 200_000 }) ?? '',
  };
}

export function validateCmsUpdate(body) {
  assertObject(body);
  return {
    title: optionalString(body, 'title', { min: 2, max: 120 }),
    content: optionalString(body, 'content', { max: 200_000 }),
  };
}
