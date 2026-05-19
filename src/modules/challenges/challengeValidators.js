import { validationError } from '../../core/ApplicationError.js';

const CHALLENGE_STATUSES = new Set(['pending', 'active', 'completed']);
const CRITERION_TYPES = new Set([
  'check_in_count',
  'breakfast_check_ins',
  'lunch_check_ins',
  'dinner_check_ins',
]);

function hasOwn(body, field) {
  return Object.prototype.hasOwnProperty.call(body, field);
}

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

function optionalString(body, field, { min = 0, max = Infinity } = {}) {
  if (!hasOwn(body, field)) {
    return undefined;
  }
  const value = body[field];
  if (value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    throw validationError(`Field '${field}' should be a valid string.`);
  }
  if (value.length < min || value.length > max) {
    throw validationError(`Field '${field}' length is invalid.`);
  }
  return value;
}

function requiredInteger(body, field, { min = -Infinity, max = Infinity } = {}) {
  if (!hasOwn(body, field)) {
    throw validationError(`Field '${field}' is required.`);
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

function optionalInteger(body, field, { min = -Infinity, max = Infinity } = {}) {
  if (!hasOwn(body, field)) {
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

function requiredDate(body, field) {
  const value = new Date(body[field]);
  if (Number.isNaN(value.getTime())) {
    throw validationError(`Field '${field}' should be a valid datetime.`);
  }
  return value;
}

function optionalDate(body, field) {
  if (!hasOwn(body, field)) {
    return undefined;
  }
  if (body[field] === null) {
    return null;
  }
  const value = new Date(body[field]);
  if (Number.isNaN(value.getTime())) {
    throw validationError(`Field '${field}' should be a valid datetime.`);
  }
  return value;
}

function optionalStatus(body, field) {
  if (!hasOwn(body, field)) {
    return undefined;
  }
  if (body[field] === null) {
    return null;
  }
  const value = String(body[field]).toLowerCase();
  if (!CHALLENGE_STATUSES.has(value)) {
    throw validationError(`Field '${field}' is invalid.`);
  }
  return value;
}

function validateCriteriaArray(value, field) {
  if (!Array.isArray(value) || value.length < 1) {
    throw validationError(`Field '${field}' must contain at least one item.`);
  }
  const criteria = value.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw validationError(`Field '${field}' contains an invalid criterion.`);
    }
    const type = String(item.type ?? '').toLowerCase();
    if (!CRITERION_TYPES.has(type)) {
      throw validationError("Challenge criteria types must be unique.");
    }
    const requiredCount = Number(item.requiredCount);
    if (!Number.isInteger(requiredCount) || requiredCount < 1 || requiredCount > 1_000_000) {
      throw validationError("Field 'requiredCount' is out of range.");
    }
    return { type, requiredCount };
  });

  if (new Set(criteria.map((item) => item.type)).size !== criteria.length) {
    throw validationError('Challenge criteria types must be unique.');
  }
  return criteria;
}

export function validateChallengeCreate(body) {
  assertObject(body);
  const payload = {
    title: requiredString(body, 'title', { min: 2, max: 120 }),
    description: requiredString(body, 'description', { min: 5, max: 2000 }),
    rewardPoints: requiredInteger(body, 'rewardPoints', { min: 0, max: 1_000_000 }),
    rewardId: optionalString(body, 'rewardId', { min: 1, max: 120 }) ?? null,
    startAt: requiredDate(body, 'startAt'),
    endAt: requiredDate(body, 'endAt'),
    criteria: validateCriteriaArray(body.criteria, 'criteria'),
    status: optionalStatus(body, 'status') ?? null,
  };
  if (payload.endAt <= payload.startAt) {
    throw validationError("Field 'endAt' must be later than 'startAt'.");
  }
  return payload;
}

export function validateChallengeUpdate(body) {
  assertObject(body);
  const payload = {
    title: optionalString(body, 'title', { min: 2, max: 120 }),
    description: optionalString(body, 'description', { min: 5, max: 2000 }),
    rewardPoints: optionalInteger(body, 'rewardPoints', { min: 0, max: 1_000_000 }),
    rewardId: hasOwn(body, 'rewardId') ? optionalString(body, 'rewardId', { min: 1, max: 120 }) ?? null : undefined,
    startAt: optionalDate(body, 'startAt'),
    endAt: optionalDate(body, 'endAt'),
    criteria: hasOwn(body, 'criteria') ? validateCriteriaArray(body.criteria, 'criteria') : undefined,
    status: optionalStatus(body, 'status'),
    hasRewardIdField: hasOwn(body, 'rewardId'),
  };
  if (payload.startAt && payload.endAt && payload.endAt <= payload.startAt) {
    throw validationError("Field 'endAt' must be later than 'startAt'.");
  }
  return payload;
}

export function parseChallengeFilters(query) {
  const search = query.search === undefined ? null : String(query.search);
  if (search !== null && (search.length < 1 || search.length > 120)) {
    throw validationError("Query parameter 'search' length is invalid.");
  }
  let statusFilter = null;
  if (query.status !== undefined) {
    statusFilter = String(query.status).toLowerCase();
    if (!CHALLENGE_STATUSES.has(statusFilter)) {
      throw validationError("Query parameter 'status' is invalid.");
    }
  }
  return { search, statusFilter };
}
