import { validationError } from '../../core/ApplicationError.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function assertObject(value, allowNull = false) {
  if (allowNull && (value === undefined || value === null)) {
    return;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw validationError('Input should be a valid dictionary or object.');
  }
}

function optionalString(body, field, { min = 0, max = Infinity } = {}) {
  const value = body?.[field];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw validationError(`Field '${field}' should be a string.`);
  if (value.length < min || value.length > max) throw validationError(`Field '${field}' length is invalid.`);
  return value;
}

function requiredString(body, field, options) {
  const value = optionalString(body, field, options);
  if (value === undefined) throw validationError(`Field '${field}' is required.`);
  return value;
}

function requiredEmail(body, field = 'email') {
  const value = requiredString(body, field);
  if (!EMAIL_RE.test(value)) throw validationError('value is not a valid email address.');
  return value;
}

function requiredInteger(body, field, { min, max }) {
  const value = body[field];
  if (!Number.isInteger(value)) throw validationError(`Field '${field}' is required.`);
  if (value < min || value > max) throw validationError(`Field '${field}' is out of range.`);
  return value;
}

export function validateOptionalSuperAdminSeed(body) {
  assertObject(body, true);
  if (body === undefined || body === null || Object.keys(body).length === 0) return null;
  return {
    fullname: requiredString(body, 'fullname', { min: 2, max: 120 }),
    phone: requiredString(body, 'phone', { min: 7, max: 30 }),
    email: requiredEmail(body),
    password: requiredString(body, 'password', { min: 8, max: 128 }),
  };
}

export function validateAdminLogin(body) {
  assertObject(body);
  return {
    email: requiredEmail(body),
    password: requiredString(body, 'password', { min: 8, max: 128 }),
  };
}

export function validateRefresh(body) {
  assertObject(body);
  return { refreshToken: requiredString(body, 'refreshToken', { min: 1 }) };
}

export function validateEmail(body) {
  assertObject(body);
  return { email: requiredEmail(body) };
}

export function validateOtp(body) {
  assertObject(body);
  return {
    email: requiredEmail(body),
    otp: requiredString(body, 'otp', { min: 4, max: 4 }),
  };
}

export function validateResetPassword(body) {
  assertObject(body);
  return {
    email: requiredEmail(body),
    new_password: requiredString(body, 'new_password', { min: 8, max: 128 }),
  };
}

export function validateChangePassword(body) {
  assertObject(body);
  return {
    current_password: requiredString(body, 'current_password', { min: 8, max: 128 }),
    new_password: requiredString(body, 'new_password', { min: 8, max: 128 }),
  };
}

export function validateAdminCreate(body) {
  assertObject(body);
  const confirmation = body.confirmPassword ?? body.confirmNewPassword;
  const password = requiredString(body, 'password', { min: 8, max: 128 });
  if (confirmation !== undefined && confirmation !== password) {
    throw validationError('Password confirmation does not match.');
  }
  return {
    fullname: requiredString(body, 'fullname', { min: 2, max: 120 }),
    phone: optionalString(body, 'phone', { min: 7, max: 30 }) ?? null,
    email: requiredEmail(body),
    password,
  };
}

export function validateAdminUpdate(body) {
  assertObject(body);
  return {
    fullname: requiredString(body, 'fullname', { min: 2, max: 120 }),
    phone: requiredString(body, 'phone', { min: 7, max: 30 }),
  };
}

export function validatePointsAdjustment(body) {
  assertObject(body);
  return { pointsDelta: requiredInteger(body, 'pointsDelta', { min: -1_000_000, max: 1_000_000 }) };
}

export function parseAdminUserFilters(query) {
  const boolOrNull = (value) => {
    if (value === undefined) return null;
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    throw validationError('Input should be a valid boolean.');
  };
  return {
    search: query.search ?? null,
    city: query.city ?? null,
    country: query.country ?? null,
    gender: query.gender ?? null,
    isVerified: boolOrNull(query.isVerified),
    isBlocked: boolOrNull(query.isBlocked),
  };
}

export function parseDashboardSummaryQuery(query) {
  const allowed = new Set(['last_24_hours', 'last_7_days', 'last_30_days', 'monthly']);
  const range = query.range === undefined ? 'last_7_days' : String(query.range).toLowerCase();
  if (!allowed.has(range)) {
    throw validationError("Query parameter 'range' is invalid.");
  }

  const parseIntField = (value, field, { min, max }) => {
    if (value === undefined) return null;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
      throw validationError(`Query parameter '${field}' is invalid.`);
    }
    return parsed;
  };

  return {
    range,
    year: parseIntField(query.year, 'year', { min: 1970, max: 3000 }),
    month: parseIntField(query.month, 'month', { min: 1, max: 12 }),
  };
}
