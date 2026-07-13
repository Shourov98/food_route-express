import { validationError } from '../../core/ApplicationError.js';

function assertObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw validationError('Input should be a valid dictionary or object.');
  }
}

function optionalString(body, field, { min = 0, max = Infinity } = {}) {
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
  return value;
}

function optionalNumber(body, field, { min = -Infinity, max = Infinity } = {}) {
  const value = body[field];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw validationError(`Field '${field}' should be a number.`);
  }
  if (value < min || value > max) {
    throw validationError(`Field '${field}' is out of range.`);
  }
  return value;
}

function optionalBoolean(body, field) {
  const value = body[field];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== 'boolean') {
    throw validationError(`Field '${field}' should be a boolean.`);
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

export function validateProfileUpdate(body) {
  assertObject(body);
  return {
    fullname: optionalString(body, 'fullname', { min: 2, max: 120 }),
    city: optionalString(body, 'city', { min: 2, max: 120 }),
    country: optionalString(body, 'country', { min: 2, max: 120 }),
  };
}

export function validateProximitySettings(body) {
  assertObject(body);
  return {
    distanceInMeter: optionalNumber(body, 'distanceInMeter', { min: 1, max: 100_000 }),
    enabled: optionalBoolean(body, 'enabled'),
  };
}

export function validateProximityScan(body) {
  assertObject(body);
  const latitude = optionalNumber(body, 'latitude', { min: -90, max: 90 });
  const longitude = optionalNumber(body, 'longitude', { min: -180, max: 180 });
  const accuracy = optionalNumber(body, 'accuracy', { min: 0, max: 1_000_000 });
  const source = optionalString(body, 'source', { min: 1, max: 100 });
  if (latitude === undefined || longitude === undefined) {
    throw validationError('latitude and longitude are required for proximity scan.');
  }
  return { latitude, longitude, accuracy, source };
}

export function validatePushToken(body) {
  assertObject(body);
  const pushToken =
    optionalString(body, 'pushToken', { min: 1, max: 4096 }) ??
    optionalString(body, 'subscriptionId', { min: 1, max: 4096 }) ??
    optionalString(body, 'playerId', { min: 1, max: 4096 });

  if (pushToken === undefined) {
    throw validationError("Field 'pushToken' is required.");
  }

  return {
    pushToken,
    platform: optionalString(body, 'platform', { min: 2, max: 30 }),
    provider: optionalString(body, 'provider', { min: 2, max: 30 }),
  };
}

export function validateSocialShare(body) {
  assertObject(body);
  const shareType = requiredString(body, 'shareType', { min: 1, max: 50 }).trim().toLowerCase();
  if (!new Set(['checkin', 'reward', 'receipt']).has(shareType)) {
    throw validationError("Field 'shareType' must be 'checkin', 'reward', or 'receipt'.");
  }
  return {
    shareType,
    entityId: optionalString(body, 'entityId', { min: 1, max: 128 }),
    platform: optionalString(body, 'platform', { min: 2, max: 50 }),
    shareUrl: optionalString(body, 'shareUrl', { max: 500 }),
  };
}
