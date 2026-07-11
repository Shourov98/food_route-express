import { validationError } from '../../core/ApplicationError.js';

const ROUTE_STATUSES = new Set(['draft', 'active', 'paused', 'completed', 'expired']);

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
  if (value === undefined || value === null || value === '') {
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

function optionalBoolean(body, field) {
  if (!hasOwn(body, field) || body[field] === undefined || body[field] === null) {
    return undefined;
  }
  if (typeof body[field] === 'boolean') {
    return body[field];
  }
  if (body[field] === 'true') {
    return true;
  }
  if (body[field] === 'false') {
    return false;
  }
  throw validationError(`Field '${field}' should be a boolean.`);
}

function optionalInteger(body, field, { min = -Infinity, max = Infinity } = {}) {
  if (!hasOwn(body, field) || body[field] === undefined || body[field] === null || body[field] === '') {
    return undefined;
  }
  const value = Number(body[field]);
  if (!Number.isInteger(value)) {
    throw validationError(`Field '${field}' should be an integer.`);
  }
  if (value < min || value > max) {
    throw validationError(`Field '${field}' is out of range.`);
  }
  return value;
}

function optionalDate(body, field) {
  if (!hasOwn(body, field) || body[field] === undefined || body[field] === null || body[field] === '') {
    return undefined;
  }
  const date = body[field] instanceof Date ? body[field] : new Date(body[field]);
  if (Number.isNaN(date.getTime())) {
    throw validationError(`Field '${field}' should be a valid date.`);
  }
  return date;
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
  const startDate = optionalDate(body, 'startDate');
  const endDate = optionalDate(body, 'endDate');
  if (startDate && endDate && endDate <= startDate) {
    throw validationError("Field 'endDate' must be after 'startDate'.");
  }
  return {
    routeName: parseRouteName(body, true),
    description: requiredString(body, 'description', { min: 5, max: 1000 }),
    city: optionalString(body, 'city', { min: 2, max: 120 }),
    zone: optionalString(body, 'zone', { min: 2, max: 120 }),
    neighborhood: optionalString(body, 'neighborhood', { min: 2, max: 120 }),
    restaurantIds: parseRestaurantIds(body.restaurantIds, true),
    status: parseStatus(body, true),
    startDate,
    endDate,
    requiredVisits: optionalInteger(body, 'requiredVisits', { min: 1 }) ?? body.restaurantIds.length,
    mandatoryOrder: optionalBoolean(body, 'mandatoryOrder') ?? false,
    pointsPerReceiptUpload: optionalInteger(body, 'pointsPerReceiptUpload', { min: 0 }) ?? 0,
    completionBonus: optionalInteger(body, 'completionBonus', { min: 0 }) ?? 0,
    limitPerUser: optionalInteger(body, 'limitPerUser', { min: 1 }) ?? 1,
    repeatable: optionalBoolean(body, 'repeatable') ?? false,
    cooldownMinutes: optionalInteger(body, 'cooldownMinutes', { min: 60 }) ?? 60,
  };
}

export function validateRouteUpdate(body) {
  assertObject(body);
  const startDate = optionalDate(body, 'startDate');
  const endDate = optionalDate(body, 'endDate');
  if (startDate && endDate && endDate <= startDate) {
    throw validationError("Field 'endDate' must be after 'startDate'.");
  }
  return {
    routeName: parseRouteName(body, false),
    description: optionalString(body, 'description', { min: 5, max: 1000 }),
    city: optionalString(body, 'city', { min: 2, max: 120 }),
    zone: optionalString(body, 'zone', { min: 2, max: 120 }),
    neighborhood: optionalString(body, 'neighborhood', { min: 2, max: 120 }),
    restaurantIds: hasOwn(body, 'restaurantIds') ? parseRestaurantIds(body.restaurantIds, false) : undefined,
    status: parseStatus(body, false),
    startDate,
    hasStartDateField: hasOwn(body, 'startDate'),
    endDate,
    hasEndDateField: hasOwn(body, 'endDate'),
    requiredVisits: optionalInteger(body, 'requiredVisits', { min: 1 }),
    mandatoryOrder: optionalBoolean(body, 'mandatoryOrder'),
    pointsPerReceiptUpload: optionalInteger(body, 'pointsPerReceiptUpload', { min: 0 }),
    completionBonus: optionalInteger(body, 'completionBonus', { min: 0 }),
    limitPerUser: optionalInteger(body, 'limitPerUser', { min: 1 }),
    repeatable: optionalBoolean(body, 'repeatable'),
    cooldownMinutes: optionalInteger(body, 'cooldownMinutes', { min: 60 }),
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

export function parseRouteAnalyticsQuery(query) {
  const range = String(query.range ?? 'last_30_days').toLowerCase();
  if (!new Set(['last_7_days', 'last_30_days', 'last_90_days']).has(range)) {
    throw validationError("Query parameter 'range' is invalid.");
  }
  return { range };
}
