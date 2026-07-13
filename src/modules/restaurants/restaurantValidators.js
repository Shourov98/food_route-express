import { ApplicationError, validationError } from '../../core/ApplicationError.js';

function assertObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw validationError('Input should be a valid dictionary or object.');
  }
}

function hasOwn(body, field) {
  return Object.prototype.hasOwnProperty.call(body, field);
}

function requiredString(body, field, { min = 0, max = Infinity } = {}) {
  const value = body[field];
  if (value === undefined || value === null) {
    throw validationError(`Field '${field}' is required.`);
  }
  if (typeof value !== 'string') {
    throw validationError(`Field '${field}' should be a string.`);
  }
  if (value.length < min || value.length > max) {
    throw validationError(`Field '${field}' length is invalid.`);
  }
  return value;
}

function optionalString(body, field, { min = 0, max = Infinity } = {}) {
  if (!hasOwn(body, field) || body[field] === undefined || body[field] === null) {
    return undefined;
  }
  if (typeof body[field] !== 'string') {
    throw validationError(`Field '${field}' should be a string.`);
  }
  if (body[field].length < min || body[field].length > max) {
    throw validationError(`Field '${field}' length is invalid.`);
  }
  return body[field];
}

function requiredTime(body, field) {
  const value = requiredString(body, field, { min: 5, max: 5 });
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    throw validationError(`Field '${field}' should use HH:mm format.`);
  }
  return value;
}

function requiredNumber(body, field, { min = -Infinity, max = Infinity } = {}) {
  if (!hasOwn(body, field)) {
    throw validationError(`Field '${field}' is required.`);
  }
  const value = Number(body[field]);
  if (Number.isNaN(value)) {
    throw validationError(`Field '${field}' should be a number.`);
  }
  if (value < min || value > max) {
    throw validationError(`Field '${field}' is out of range.`);
  }
  return value;
}

function requiredInteger(body, field, { min = -Infinity, max = Infinity } = {}) {
  const value = requiredNumber(body, field, { min, max });
  if (!Number.isInteger(value)) {
    throw validationError(`Field '${field}' should be an integer.`);
  }
  return value;
}

function optionalBoolean(body, field) {
  if (!hasOwn(body, field) || body[field] === undefined || body[field] === null) {
    return undefined;
  }
  const raw = body[field];
  if (typeof raw === 'boolean') {
    return raw;
  }
  if (raw === 'true') {
    return true;
  }
  if (raw === 'false') {
    return false;
  }
  throw validationError(`Field '${field}' should be a boolean.`);
}

function requireImage(file) {
  if (!file) {
    throw new ApplicationError({
      code: 'validation_error',
      message: "Field 'image' is required.",
      statusCode: 422,
    });
  }
}

function parseQrCode(body) {
  return {
    name: requiredString(body, 'qrCodeName', { min: 2, max: 120 }),
    location: {
      latitude: requiredNumber(body, 'qrCodeLatitude'),
      longitude: requiredNumber(body, 'qrCodeLongitude'),
    },
    token: requiredString(body, 'qrCodeToken', { min: 4, max: 128 }),
  };
}

export function validateRestaurantCreate(body, file) {
  assertObject(body);
  requireImage(file);
  const pointsPerCheckIn = requiredInteger(body, 'pointsPerCheckIn', { min: 0, max: 10_000 });
  const checkinRadiusMeters = hasOwn(body, 'checkinRadiusMeters')
    ? requiredInteger(body, 'checkinRadiusMeters', { min: 10, max: 5_000 })
    : 100;
  return {
    name: requiredString(body, 'name', { min: 2, max: 120 }),
    address: requiredString(body, 'address', { min: 5, max: 255 }),
    city: optionalString(body, 'city', { min: 2, max: 120 }) ?? null,
    latitude: requiredNumber(body, 'latitude'),
    longitude: requiredNumber(body, 'longitude'),
    category: requiredString(body, 'category', { min: 2, max: 60 }),
    openingTime: requiredTime(body, 'openingTime'),
    closingTime: requiredTime(body, 'closingTime'),
    imageUrl: null,
    qrCode: parseQrCode(body),
    pointsPerCheckIn,
    checkinRadiusMeters,
    receiptUploadEnabled: true,
    pointsPerReceiptUpload: hasOwn(body, 'pointsPerReceiptUpload')
      ? requiredInteger(body, 'pointsPerReceiptUpload', { min: 0, max: 10_000 })
      : pointsPerCheckIn,
  };
}

export function validateRestaurantUpdate(body) {
  assertObject(body);
  return {
    name: requiredString(body, 'name', { min: 2, max: 120 }),
    address: requiredString(body, 'address', { min: 5, max: 255 }),
    city: optionalString(body, 'city', { min: 2, max: 120 }) ?? null,
    latitude: requiredNumber(body, 'latitude'),
    longitude: requiredNumber(body, 'longitude'),
    category: requiredString(body, 'category', { min: 2, max: 60 }),
    openingTime: requiredTime(body, 'openingTime'),
    closingTime: requiredTime(body, 'closingTime'),
    imageUrl: optionalString(body, 'imageUrl') ?? null,
    qrCode: parseQrCode(body),
    pointsPerCheckIn: requiredInteger(body, 'pointsPerCheckIn', { min: 0, max: 10_000 }),
    checkinRadiusMeters: hasOwn(body, 'checkinRadiusMeters')
      ? requiredInteger(body, 'checkinRadiusMeters', { min: 10, max: 5_000 })
      : 100,
    pointsPerReceiptUpload: hasOwn(body, 'pointsPerReceiptUpload')
      ? requiredInteger(body, 'pointsPerReceiptUpload', { min: 0, max: 10_000 })
      : undefined,
    hasPointsPerReceiptUploadField: hasOwn(body, 'pointsPerReceiptUpload'),
  };
}

export function validateMenuItemCreate(body) {
  assertObject(body);
  return {
    name: requiredString(body, 'name', { min: 2, max: 120 }),
    description: requiredString(body, 'description', { min: 2, max: 1000 }),
    price: requiredNumber(body, 'price', { min: 0, max: 100_000 }),
    pointsToBuy: requiredInteger(body, 'pointsToBuy', { min: 0, max: 1_000_000 }),
    isAvailable: optionalBoolean(body, 'isAvailable') ?? true,
  };
}

export function validateMenuItemUpdate(body) {
  assertObject(body);
  return {
    name: optionalString(body, 'name', { min: 2, max: 120 }),
    description: optionalString(body, 'description', { min: 2, max: 1000 }),
    price: hasOwn(body, 'price')
      ? requiredNumber(body, 'price', { min: 0, max: 100_000 })
      : undefined,
    pointsToBuy: hasOwn(body, 'pointsToBuy')
      ? requiredInteger(body, 'pointsToBuy', { min: 0, max: 1_000_000 })
      : undefined,
    imageUrl: hasOwn(body, 'imageUrl') ? body.imageUrl : undefined,
    isAvailable: optionalBoolean(body, 'isAvailable'),
    hasImageUrlField: hasOwn(body, 'imageUrl'),
  };
}

export function parseRestaurantAnalyticsQuery(query) {
  const range = String(query.range ?? 'last_30_days').toLowerCase();
  if (!new Set(['last_7_days', 'last_30_days', 'last_90_days']).has(range)) {
    throw validationError("Query parameter 'range' is invalid.");
  }
  return { range };
}
