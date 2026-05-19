import { validationError } from '../../core/ApplicationError.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function assertObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw validationError('Input should be a valid dictionary or object.');
  }
}

function requiredString(body, field, { min = 1, max = Infinity, pattern } = {}) {
  const value = body[field];
  if (typeof value !== 'string') {
    throw validationError(`Field '${field}' is required.`);
  }
  if (value.length < min) {
    throw validationError(`Field '${field}' should have at least ${min} characters.`);
  }
  if (value.length > max) {
    throw validationError(`Field '${field}' should have at most ${max} characters.`);
  }
  if (pattern && !pattern.test(value)) {
    throw validationError(`Field '${field}' is invalid.`);
  }
  return value;
}

function requiredEmail(body, field = 'email') {
  const value = requiredString(body, field);
  if (!EMAIL_RE.test(value)) {
    throw validationError('value is not a valid email address.');
  }
  return value;
}

function requiredInteger(body, field, { min, max }) {
  const value = body[field];
  if (!Number.isInteger(value)) {
    throw validationError(`Field '${field}' is required.`);
  }
  if (value < min || value > max) {
    throw validationError(`Field '${field}' is out of range.`);
  }
  return value;
}

function requiredDateOfBirth(body, field = 'dateOfBirth') {
  const value = requiredString(body, field, { min: 10, max: 10, pattern: /^\d{4}-\d{2}-\d{2}$/ });
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw validationError(`Field '${field}' is invalid.`);
  }
  if (parsed.getTime() > Date.now()) {
    throw validationError(`Field '${field}' must not be in the future.`);
  }
  return value;
}

export function validateRegister(body) {
  assertObject(body);
  return {
    fullname: requiredString(body, 'fullname', { min: 2, max: 120 }),
    email: requiredEmail(body),
    gender: requiredString(body, 'gender', { min: 1, max: 30 }),
    dateOfBirth: requiredDateOfBirth(body),
    city: requiredString(body, 'city', { min: 2, max: 120 }),
    country: requiredString(body, 'country', { min: 2, max: 120 }),
    password: requiredString(body, 'password', { min: 8, max: 128 }),
  };
}

export function validateReferralRegister(body) {
  return {
    ...validateRegister(body),
    referralCode: requiredString(body, 'referralCode', {
      min: 8,
      max: 8,
      pattern: /^[A-Z0-9]{8}$/,
    }),
  };
}

export function validateEmail(body) {
  assertObject(body);
  return { email: requiredEmail(body) };
}

export function validateOtp(body) {
  assertObject(body);
  return {
    email: requiredEmail(body),
    otp: requiredString(body, 'otp', { min: 4, max: 4, pattern: /^\d{4}$/ }),
  };
}

export function validateLogin(body) {
  assertObject(body);
  return {
    email: requiredEmail(body),
    password: requiredString(body, 'password', { min: 8, max: 128 }),
  };
}

export function validateRefresh(body) {
  assertObject(body);
  return {
    refreshToken: requiredString(body, 'refreshToken', { min: 1 }),
  };
}

export function validateChangePassword(body) {
  assertObject(body);
  return {
    current_password: requiredString(body, 'current_password', { min: 8, max: 128 }),
    new_password: requiredString(body, 'new_password', { min: 8, max: 128 }),
  };
}
