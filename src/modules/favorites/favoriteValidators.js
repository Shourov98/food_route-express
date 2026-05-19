import { validationError } from '../../core/ApplicationError.js';

function optionalString(value, field, { min = 0, max = Infinity } = {}) {
  if (value === undefined) {
    return null;
  }
  if (typeof value !== 'string') {
    throw validationError(`Query parameter '${field}' should be a string.`);
  }
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) {
    throw validationError(`Query parameter '${field}' length is invalid.`);
  }
  return trimmed;
}

function optionalNumber(value, field) {
  if (value === undefined) {
    return null;
  }
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw validationError(`Query parameter '${field}' should be a number.`);
  }
  return parsed;
}

export function parseFavoriteFilters(query) {
  return {
    search: optionalString(query.search, 'search', { min: 1, max: 120 }),
    city: optionalString(query.city, 'city', { min: 2, max: 120 }),
    latitude: optionalNumber(query.latitude, 'latitude'),
    longitude: optionalNumber(query.longitude, 'longitude'),
  };
}
