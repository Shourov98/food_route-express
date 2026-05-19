import { validationError } from '../../core/ApplicationError.js';

const ROUTE_STATUSES = new Set(['draft', 'active', 'under_review']);

function hasOwn(body, field) {
  return Object.prototype.hasOwnProperty.call(body, field);
}

function assertObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw validationError('Input should be a valid dictionary or object.');
  }
}

function optionalString(body, field, { min = 0, max = Infinity } = {}) {
  if (!hasOwn(body, field)) {
    return undefined;
  }
  const value = body[field];
  if (typeof value !== 'string') {
    throw validationError(`Field '${field}' should be a string.`);
  }
  if (value.length < min || value.length > max) {
    throw validationError(`Field '${field}' length is invalid.`);
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

function parseRouteName(body, required) {
  const routeName = optionalString(body, 'routeName', { min: 2, max: 120 });
  const alias = optionalString(body, 'name', { min: 2, max: 120 });
  const value = routeName ?? alias;
  if (required && value === undefined) {
    throw validationError("Field 'routeName' is required.");
  }
  return value;
}

function parseRestaurantIds(value, required) {
  if (value === undefined) {
    if (required) {
      throw validationError("Field 'restaurantIds' is required.");
    }
    return undefined;
  }
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw validationError("Field 'restaurantIds' should be an array of strings.");
  }
  if (required && value.length < 1) {
    throw validationError("Field 'restaurantIds' is required.");
  }
  if (new Set(value).size !== value.length) {
    throw validationError("Field 'restaurantIds' must not contain duplicate values.");
  }
  return value;
}

function parseStatus(body, required = false) {
  if (!hasOwn(body, 'status')) {
    return required ? 'draft' : undefined;
  }
  const value = body.status;
  if (typeof value !== 'string' || !ROUTE_STATUSES.has(value)) {
    throw validationError("Field 'status' is invalid.");
  }
  return value;
}

export function validateRouteCreate(body) {
  assertObject(body);
  return {
    routeName: parseRouteName(body, true),
    description: requiredString(body, 'description', { min: 5, max: 1000 }),
    city: optionalString(body, 'city', { min: 2, max: 120 }),
    restaurantIds: parseRestaurantIds(body.restaurantIds, true),
    status: parseStatus(body, true),
  };
}

export function validateRouteUpdate(body) {
  assertObject(body);
  return {
    routeName: parseRouteName(body, false),
    description: optionalString(body, 'description', { min: 5, max: 1000 }),
    city: optionalString(body, 'city', { min: 2, max: 120 }),
    restaurantIds: hasOwn(body, 'restaurantIds') ? parseRestaurantIds(body.restaurantIds, false) : undefined,
    status: parseStatus(body, false),
  };
}

function parseBoolQuery(value, field) {
  if (value === undefined) {
    return null;
  }
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw validationError(`Query parameter '${field}' should be a boolean.`);
}

export function parseRouteFilters(query) {
  const status = query.status ?? null;
  if (status !== null && !ROUTE_STATUSES.has(status)) {
    throw validationError("Query parameter 'status' is invalid.");
  }
  return {
    search: query.search ?? null,
    city: query.city ?? null,
    statusFilter: status,
    _unused: parseBoolQuery(undefined, 'noop'),
  };
}

export function parseRouteRestaurantSearch(query) {
  if (
    query.search !== undefined &&
    (typeof query.search !== 'string' || query.search.length < 1 || query.search.length > 120)
  ) {
    throw validationError("Query parameter 'search' length is invalid.");
  }
  if (
    query.city !== undefined &&
    (typeof query.city !== 'string' || query.city.length < 2 || query.city.length > 120)
  ) {
    throw validationError("Query parameter 'city' length is invalid.");
  }
  return {
    city: query.city ?? null,
    search: query.search ?? null,
  };
}
