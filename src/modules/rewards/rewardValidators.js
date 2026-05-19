import { validationError } from '../../core/ApplicationError.js';

function hasOwn(body, field) {
  return Object.prototype.hasOwnProperty.call(body, field);
}

function assertObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw validationError('Input should be a valid dictionary or object.');
  }
}

function normalizeOptionalString(value) {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw validationError('Input should be a valid string.');
  }
  const trimmed = value.trim();
  if (trimmed === '' || trimmed.toLowerCase() === 'none' || trimmed.toLowerCase() === 'null') {
    return null;
  }
  return trimmed;
}

function requiredString(body, field, { min = 0, max = Infinity } = {}) {
  const value = body[field];
  if (value === undefined || value === null || typeof value !== 'string') {
    throw validationError(`Field '${field}' is required.`);
  }
  if (value.length < min || value.length > max) {
    throw validationError(`Field '${field}' length is invalid.`);
  }
  return value;
}

function optionalString(body, field, { min = 0, max = Infinity } = {}) {
  if (!hasOwn(body, field)) {
    return undefined;
  }
  const normalized = normalizeOptionalString(body[field]);
  if (normalized === null) {
    return null;
  }
  if (normalized === undefined) {
    return undefined;
  }
  if (normalized.length < min || normalized.length > max) {
    throw validationError(`Field '${field}' length is invalid.`);
  }
  return normalized;
}

function parseNumber(raw, field) {
  const value = Number(raw);
  if (Number.isNaN(value)) {
    throw validationError(`Field '${field}' should be a number.`);
  }
  return value;
}

function requiredInteger(body, field, { min = -Infinity, max = Infinity } = {}) {
  if (!hasOwn(body, field)) {
    throw validationError(`Field '${field}' is required.`);
  }
  const value = parseNumber(body[field], field);
  if (!Number.isInteger(value)) {
    throw validationError(`Field '${field}' should be an integer.`);
  }
  if (value < min || value > max) {
    throw validationError(`Field '${field}' is out of range.`);
  }
  return value;
}

function optionalInteger(body, field, { min = -Infinity, max = Infinity } = {}) {
  if (!hasOwn(body, field)) {
    return undefined;
  }
  if (body[field] === '') {
    return undefined;
  }
  const value = parseNumber(body[field], field);
  if (!Number.isInteger(value)) {
    throw validationError(`Field '${field}' should be an integer.`);
  }
  if (value < min || value > max) {
    throw validationError(`Field '${field}' is out of range.`);
  }
  return value;
}

function optionalBoolean(body, field) {
  if (!hasOwn(body, field)) {
    return undefined;
  }
  const value = body[field];
  if (value === true || value === 'true') {
    return true;
  }
  if (value === false || value === 'false') {
    return false;
  }
  throw validationError(`Field '${field}' should be a boolean.`);
}

function optionalDate(body, field) {
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

export function validateRewardCreate(body) {
  assertObject(body);
  const payload = {
    title: requiredString(body, 'title', { min: 2, max: 120 }),
    description: requiredString(body, 'description', { min: 5, max: 1000 }),
    pointsRequired: requiredInteger(body, 'pointsRequired', { min: 0, max: 1_000_000 }),
    quantityAvailable: requiredInteger(body, 'quantityAvailable', { min: 0, max: 1_000_000 }),
    rewardCategory: requiredString(body, 'rewardCategory', { min: 2, max: 120 }),
    xpPoints: null,
    foodItemName: null,
    discountPercentage: null,
    giftCardCode: null,
    termsAndConditions: null,
    imageUrl: null,
    isActive: optionalBoolean(body, 'isActive') ?? true,
    hasExpiry: optionalBoolean(body, 'hasExpiry') ?? false,
    expiresAt: optionalDate(body, 'expiresAt') ?? null,
  };
  if (payload.hasExpiry && payload.expiresAt === null) {
    throw validationError("Field 'expiresAt' is required when 'hasExpiry' is true.");
  }
  if (!payload.hasExpiry && payload.expiresAt !== null) {
    throw validationError("Field 'expiresAt' must be omitted when 'hasExpiry' is false.");
  }
  return payload;
}

export function validateRewardUpdate(body) {
  assertObject(body);
  return {
    title: optionalString(body, 'title', { min: 2, max: 120 }),
    description: optionalString(body, 'description', { min: 5, max: 1000 }),
    pointsRequired: optionalInteger(body, 'pointsRequired', { min: 0, max: 1_000_000 }),
    quantityAvailable: optionalInteger(body, 'quantityAvailable', { min: 0, max: 1_000_000 }),
    rewardCategory: hasOwn(body, 'rewardCategory')
      ? optionalString(body, 'rewardCategory', { min: 2, max: 120 }) ?? null
      : undefined,
    imageUrl: hasOwn(body, 'imageUrl') ? normalizeOptionalString(body.imageUrl) : undefined,
    isActive: optionalBoolean(body, 'isActive'),
    hasExpiry: optionalBoolean(body, 'hasExpiry'),
    expiresAt: optionalDate(body, 'expiresAt'),
    hasRewardCategoryField: hasOwn(body, 'rewardCategory'),
    hasImageUrlField: hasOwn(body, 'imageUrl'),
    hasExpiresAtField: hasOwn(body, 'expiresAt'),
  };
}

function parseBoolQuery(value, field) {
  if (value === undefined) {
    return null;
  }
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  throw validationError(`Query parameter '${field}' should be a boolean.`);
}

function parseIntQuery(value, field, { min = -Infinity, max = Infinity } = {}) {
  if (value === undefined) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw validationError(`Query parameter '${field}' should be an integer.`);
  }
  if (parsed < min || parsed > max) {
    throw validationError(`Query parameter '${field}' is out of range.`);
  }
  return parsed;
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

export function parseRewardFilters(query) {
  const minPoints = parseIntQuery(query.minPoints, 'minPoints', { min: 0, max: 1_000_000 });
  const maxPoints = parseIntQuery(query.maxPoints, 'maxPoints', { min: 0, max: 1_000_000 });
  if (minPoints !== null && maxPoints !== null && minPoints > maxPoints) {
    throw validationError("Query parameter 'minPoints' must be less than or equal to 'maxPoints'.");
  }

  const expiresFrom = parseDateQuery(query.expiresFrom, 'expiresFrom');
  const expiresTo = parseDateQuery(query.expiresTo, 'expiresTo');
  if (expiresFrom && expiresTo && expiresFrom > expiresTo) {
    throw validationError("Query parameter 'expiresFrom' must be less than or equal to 'expiresTo'.");
  }

  const sortBy = query.sortBy ?? 'createdAt';
  const allowedSortBy = new Set([
    'createdAt',
    'updatedAt',
    'title',
    'pointsRequired',
    'quantityAvailable',
    'expiresAt',
  ]);
  if (!allowedSortBy.has(sortBy)) {
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
    minPoints,
    maxPoints,
    expiresFrom,
    expiresTo,
    sortBy,
    sortOrder,
  };
}
