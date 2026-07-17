import { ApplicationError, validationError } from '../../core/ApplicationError.js';
import { getActiveCityNames, isActiveCity, loadGeographyConfig } from '../geography/geographyPolicy.js';

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

function hasQrCodeField(body) {
  return (
    hasOwn(body, 'qrCodeName') ||
    hasOwn(body, 'qrCodeLatitude') ||
    hasOwn(body, 'qrCodeLongitude') ||
    hasOwn(body, 'qrCodeToken')
  );
}

function parseQrCode(body) {
  const name = optionalString(body, 'qrCodeName', { min: 2, max: 120 });
  const latitude = hasOwn(body, 'qrCodeLatitude') ? Number(body.qrCodeLatitude) : null;
  const longitude = hasOwn(body, 'qrCodeLongitude') ? Number(body.qrCodeLongitude) : null;
  const token = optionalString(body, 'qrCodeToken', { min: 4, max: 128 });

  return {
    name,
    location: {
      latitude: Number.isFinite(latitude) ? latitude : null,
      longitude: Number.isFinite(longitude) ? longitude : null,
    },
    token: token ?? null,
  };
}

export function validateRestaurantCreate(body, file, { geographyConfig = loadGeographyConfig() } = {}) {
  assertObject(body);
  requireImage(file);
  const pointsPerCheckIn = requiredInteger(body, 'pointsPerCheckIn', { min: 0, max: 10_000 });
  const checkinRadiusMeters = hasOwn(body, 'checkinRadiusMeters')
    ? requiredInteger(body, 'checkinRadiusMeters', { min: 10, max: 5_000 })
    : 100;
  const city = optionalString(body, 'city', { min: 2, max: 120 }) ?? null;
  assertActiveCity(city, geographyConfig);
  return {
    name: requiredString(body, 'name', { min: 2, max: 120 }),
    address: requiredString(body, 'address', { min: 5, max: 255 }),
    city,
    latitude: requiredNumber(body, 'latitude'),
    longitude: requiredNumber(body, 'longitude'),
    category: requiredString(body, 'category', { min: 2, max: 60 }),
    openingTime: requiredTime(body, 'openingTime'),
    closingTime: requiredTime(body, 'closingTime'),
    imageUrl: null,
    qrCode: parseQrCode(body),
    pointsPerCheckIn,
    checkinRadiusMeters,
    // BR-003: per-restaurant toggle for whether a QR scan is required.
    // Defaults to true (current MVP behavior). Admins can opt out for
    // restaurants that want GPS-only check-in.
    qrRequired: optionalBoolean(body, 'qrRequired') ?? true,
    pointsPerSocialShare: hasOwn(body, 'pointsPerSocialShare')
      ? requiredInteger(body, 'pointsPerSocialShare', { min: 0, max: 10_000 })
      : 0,
    receiptUploadEnabled: true,
    pointsPerReceiptUpload: hasOwn(body, 'pointsPerReceiptUpload')
      ? requiredInteger(body, 'pointsPerReceiptUpload', { min: 0, max: 10_000 })
      : pointsPerCheckIn,
  };
}

function assertActiveCity(city, geographyConfig) {
  if (!city) return; // city is optional for create/update
  if (isActiveCity(city, geographyConfig)) return;
  throw new ApplicationError({
    code: 'restaurant_city_out_of_service',
    message: `Field 'city' must be one of: ${getActiveCityNames(geographyConfig).join(', ')}.`,
    statusCode: 422,
    details: {
      activeCities: getActiveCityNames(geographyConfig),
      providedCity: city,
    },
  });
}

export function validateRestaurantUpdate(body, { geographyConfig = loadGeographyConfig() } = {}) {
  assertObject(body);
  const city = optionalString(body, 'city', { min: 2, max: 120 }) ?? null;
  assertActiveCity(city, geographyConfig);
  return {
    name: requiredString(body, 'name', { min: 2, max: 120 }),
    address: requiredString(body, 'address', { min: 5, max: 255 }),
    city,
    latitude: requiredNumber(body, 'latitude'),
    longitude: requiredNumber(body, 'longitude'),
    category: requiredString(body, 'category', { min: 2, max: 60 }),
    openingTime: requiredTime(body, 'openingTime'),
    closingTime: requiredTime(body, 'closingTime'),
    imageUrl: optionalString(body, 'imageUrl') ?? null,
    qrCode: hasQrCodeField(body) ? parseQrCode(body) : undefined,
    hasQrCodeField: hasQrCodeField(body),
    pointsPerCheckIn: requiredInteger(body, 'pointsPerCheckIn', { min: 0, max: 10_000 }),
    checkinRadiusMeters: hasOwn(body, 'checkinRadiusMeters')
      ? requiredInteger(body, 'checkinRadiusMeters', { min: 10, max: 5_000 })
      : 100,
    qrRequired: optionalBoolean(body, 'qrRequired'),
    pointsPerSocialShare: hasOwn(body, 'pointsPerSocialShare')
      ? requiredInteger(body, 'pointsPerSocialShare', { min: 0, max: 10_000 })
      : undefined,
    pointsPerReceiptUpload: hasOwn(body, 'pointsPerReceiptUpload')
      ? requiredInteger(body, 'pointsPerReceiptUpload', { min: 0, max: 10_000 })
      : undefined,
    hasQrRequiredField: hasOwn(body, 'qrRequired'),
    hasPointsPerSocialShareField: hasOwn(body, 'pointsPerSocialShare'),
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
