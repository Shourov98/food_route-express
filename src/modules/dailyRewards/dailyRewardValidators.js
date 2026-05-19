import { validationError } from '../../core/ApplicationError.js';

function hasOwn(body, field) {
  return Object.prototype.hasOwnProperty.call(body, field);
}

function assertObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw validationError('Input should be a valid dictionary or object.');
  }
}

function parseInteger(body, field, { min = -Infinity, max = Infinity } = {}, required = false) {
  if (!hasOwn(body, field)) {
    if (required) {
      throw validationError(`Field '${field}' is required.`);
    }
    return undefined;
  }
  if (body[field] === '') {
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

function parseBoolean(body, field) {
  if (!hasOwn(body, field)) {
    return undefined;
  }
  if (body[field] === true || body[field] === 'true') {
    return true;
  }
  if (body[field] === false || body[field] === 'false') {
    return false;
  }
  throw validationError(`Field '${field}' should be a boolean.`);
}

function parseDate(body, field) {
  if (!hasOwn(body, field)) {
    return undefined;
  }
  if (body[field] === '') {
    return undefined;
  }
  const value = new Date(body[field]);
  if (Number.isNaN(value.getTime())) {
    throw validationError(`Field '${field}' should be a valid datetime.`);
  }
  return value;
}

export function validateDailyRewardCreate(body) {
  assertObject(body);
  const pointsReward = parseInteger(body, 'pointsReward', { min: 0, max: 1_000_000 });
  const discountPercentage = parseInteger(body, 'discountPercentage', { min: 0, max: 1_000_000 });
  const normalizedPointsReward = pointsReward ?? discountPercentage;
  if (normalizedPointsReward === undefined) {
    throw validationError("Field 'pointsReward' is required.");
  }
  const payload = {
    pointsReward: normalizedPointsReward,
    discountPercentage: discountPercentage ?? normalizedPointsReward,
    quantityAvailable: parseInteger(body, 'quantityAvailable', { min: 0, max: 1_000_000 }, true),
    probability: parseInteger(body, 'probability', { min: 0, max: 100 }) ?? 0,
    imageUrl: null,
    isActive: parseBoolean(body, 'isActive') ?? true,
    hasExpiry: parseBoolean(body, 'hasExpiry') ?? false,
    expiresAt: parseDate(body, 'expiresAt') ?? null,
  };
  if (payload.hasExpiry && payload.expiresAt === null) {
    throw validationError("Field 'expiresAt' is required when 'hasExpiry' is true.");
  }
  if (!payload.hasExpiry && payload.expiresAt !== null) {
    throw validationError("Field 'expiresAt' must be omitted when 'hasExpiry' is false.");
  }
  return payload;
}

export function validateDailyRewardUpdate(body) {
  assertObject(body);
  const pointsReward = parseInteger(body, 'pointsReward', { min: 0, max: 1_000_000 });
  const discountPercentage = parseInteger(body, 'discountPercentage', { min: 0, max: 1_000_000 });
  return {
    pointsReward: pointsReward ?? discountPercentage,
    discountPercentage: discountPercentage ?? pointsReward,
    quantityAvailable: parseInteger(body, 'quantityAvailable', { min: 0, max: 1_000_000 }),
    probability: parseInteger(body, 'probability', { min: 0, max: 100 }),
    imageUrl: hasOwn(body, 'imageUrl') ? String(body.imageUrl || '') || null : undefined,
    isActive: parseBoolean(body, 'isActive'),
    hasExpiry: parseBoolean(body, 'hasExpiry'),
    expiresAt: parseDate(body, 'expiresAt'),
    hasImageUrlField: hasOwn(body, 'imageUrl'),
    hasExpiresAtField: hasOwn(body, 'expiresAt'),
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

function parseDateQuery(value, field) {
  if (value === undefined) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw validationError(`Query parameter '${field}' should be a valid datetime.`);
  }
  return parsed;
}

export function parseDailyRewardFilters(query) {
  const expiresFrom = parseDateQuery(query.expiresFrom, 'expiresFrom');
  const expiresTo = parseDateQuery(query.expiresTo, 'expiresTo');
  if (expiresFrom && expiresTo && expiresFrom > expiresTo) {
    throw validationError("Query parameter 'expiresFrom' must be less than or equal to 'expiresTo'.");
  }

  const sortBy = query.sortBy ?? 'createdAt';
  const allowed = new Set([
    'createdAt',
    'updatedAt',
    'discountPercentage',
    'pointsReward',
    'quantityAvailable',
    'probability',
    'expiresAt',
  ]);
  if (!allowed.has(sortBy)) {
    throw validationError("Query parameter 'sortBy' is invalid.");
  }

  const sortOrder = query.sortOrder ?? 'desc';
  if (!new Set(['asc', 'desc']).has(sortOrder)) {
    throw validationError("Query parameter 'sortOrder' is invalid.");
  }

  const statusFilter = query.status ?? null;
  if (statusFilter && !new Set(['active', 'inactive', 'expired']).has(statusFilter)) {
    throw validationError("Query parameter 'status' is invalid.");
  }

  return {
    search: query.search ?? null,
    statusFilter,
    isActive: parseBoolQuery(query.isActive, 'isActive'),
    hasExpiry: parseBoolQuery(query.hasExpiry, 'hasExpiry'),
    expiresFrom,
    expiresTo,
    sortBy,
    sortOrder,
  };
}
