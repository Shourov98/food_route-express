import { validationError } from '../../core/ApplicationError.js';

const CAMPAIGN_CATEGORIES = new Set(['promotional', 'onboarding', 'reward', 'retention']);
const TARGET_AUDIENCES = new Set([
  'all_users',
  'nearby_users',
  'new_user',
  'top_10_users',
  'global',
  'inactive_shoppers',
  'city',
  'age_group',
  'custom',
]);
const DELIVERY_TYPES = new Set(['send_now', 'schedule_later']);
const CAMPAIGN_STATUSES = new Set(['draft', 'scheduled', 'active', 'completed']);
const SORT_FIELDS = new Set([
  'createdAt',
  'updatedAt',
  'campaignTitle',
  'scheduledAt',
  'deliveryRate',
  'campaignCategory',
  'deliveryType',
]);
const SORT_ORDERS = new Set(['asc', 'desc']);

function hasOwn(body, field) {
  return Object.prototype.hasOwnProperty.call(body, field);
}

function assertObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw validationError('Input should be a valid dictionary or object.');
  }
}

function getAliased(body, aliases) {
  for (const alias of aliases) {
    if (hasOwn(body, alias)) {
      return body[alias];
    }
  }
  return undefined;
}

function requiredString(body, aliases, field, { min = 0, max = Infinity } = {}) {
  const value = getAliased(body, aliases);
  if (typeof value !== 'string') {
    throw validationError(`Field '${field}' is required.`);
  }
  if (value.length < min || value.length > max) {
    throw validationError(`Field '${field}' length is invalid.`);
  }
  return value;
}

function optionalString(body, aliases, field, { min = 0, max = Infinity } = {}) {
  const value = getAliased(body, aliases);
  if (value === undefined) {
    return undefined;
  }
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

function optionalEnum(body, aliases, field, values) {
  const value = getAliased(body, aliases);
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const normalized = String(value).toLowerCase();
  if (!values.has(normalized)) {
    throw validationError(`Field '${field}' is invalid.`);
  }
  return normalized;
}

function optionalDate(body, aliases, field) {
  const value = getAliased(body, aliases);
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw validationError(`Field '${field}' should be a valid datetime.`);
  }
  return parsed;
}

function optionalNumber(body, aliases, field, { min = -Infinity, max = Infinity } = {}) {
  const value = getAliased(body, aliases);
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw validationError(`Field '${field}' should be a number.`);
  }
  if (parsed < min || parsed > max) {
    throw validationError(`Field '${field}' is out of range.`);
  }
  return parsed;
}

function validateAudienceRequirements(payload) {
  if (payload.targetAudience === 'city' && !payload.cityName) {
    throw validationError("Field 'cityName' is required when targetAudience is 'city'.");
  }
  if (payload.targetAudience === 'age_group' && !payload.ageGroup) {
    throw validationError("Field 'ageGroup' is required when targetAudience is 'age_group'.");
  }
}

export function validateNotificationCampaignCreate(body) {
  assertObject(body);
  const payload = {
    campaignTitle: requiredString(body, ['campaignTitle', 'campaignName', 'title'], 'campaignTitle', {
      min: 2,
      max: 120,
    }),
    campaignBody: requiredString(body, ['campaignBody', 'messagePreview', 'body'], 'campaignBody', {
      min: 5,
      max: 1000,
    }),
    campaignCategory: optionalEnum(body, ['campaignCategory', 'category'], 'campaignCategory', CAMPAIGN_CATEGORIES),
    targetAudience: optionalEnum(body, ['targetAudience'], 'targetAudience', TARGET_AUDIENCES),
    cityName: optionalString(body, ['cityName', 'city', 'targetCity'], 'cityName', { min: 2, max: 120 }) ?? null,
    ageGroup: optionalString(body, ['ageGroup', 'age', 'targetAgeGroup'], 'ageGroup', { min: 1, max: 50 }) ?? null,
    deliveryType:
      optionalEnum(body, ['deliveryType', 'delivery_type'], 'deliveryType', DELIVERY_TYPES) ?? 'send_now',
    scheduledAt: optionalDate(body, ['scheduledAt'], 'scheduledAt') ?? null,
    status: optionalEnum(body, ['status'], 'status', CAMPAIGN_STATUSES) ?? null,
    deliveryRate: optionalNumber(body, ['deliveryRate'], 'deliveryRate', { min: 0, max: 100 }) ?? 0,
  };
  if (!payload.campaignCategory) {
    throw validationError("Field 'campaignCategory' is required.");
  }
  if (!payload.targetAudience) {
    throw validationError("Field 'targetAudience' is required.");
  }
  validateAudienceRequirements(payload);
  if (payload.deliveryType === 'send_now' && payload.scheduledAt !== null) {
    throw validationError("Field 'scheduledAt' must be omitted when deliveryType is 'send_now'.");
  }
  if (payload.deliveryType === 'schedule_later' && payload.scheduledAt === null) {
    throw validationError("Field 'scheduledAt' is required when deliveryType is 'schedule_later'.");
  }
  if (payload.status === 'scheduled' && payload.deliveryType !== 'schedule_later') {
    throw validationError("Status 'scheduled' requires deliveryType 'schedule_later'.");
  }
  if (payload.status === 'active' && payload.deliveryType !== 'send_now') {
    throw validationError("Status 'active' requires deliveryType 'send_now'.");
  }
  return payload;
}

export function validateNotificationCampaignUpdate(body) {
  assertObject(body);
  const payload = {
    campaignTitle: optionalString(body, ['campaignTitle', 'campaignName', 'title'], 'campaignTitle', {
      min: 2,
      max: 120,
    }),
    campaignBody: optionalString(body, ['campaignBody', 'messagePreview', 'body'], 'campaignBody', {
      min: 5,
      max: 1000,
    }),
    campaignCategory: optionalEnum(body, ['campaignCategory', 'category'], 'campaignCategory', CAMPAIGN_CATEGORIES),
    targetAudience: optionalEnum(body, ['targetAudience'], 'targetAudience', TARGET_AUDIENCES),
    cityName: optionalString(body, ['cityName', 'city', 'targetCity'], 'cityName', { min: 2, max: 120 }),
    ageGroup: optionalString(body, ['ageGroup', 'age', 'targetAgeGroup'], 'ageGroup', { min: 1, max: 50 }),
    deliveryType: optionalEnum(body, ['deliveryType', 'delivery_type'], 'deliveryType', DELIVERY_TYPES),
    scheduledAt: optionalDate(body, ['scheduledAt'], 'scheduledAt'),
    status: optionalEnum(body, ['status'], 'status', CAMPAIGN_STATUSES),
    deliveryRate: optionalNumber(body, ['deliveryRate'], 'deliveryRate', { min: 0, max: 100 }),
    hasScheduledAtField: hasOwn(body, 'scheduledAt'),
  };
  if (payload.targetAudience !== undefined) {
    validateAudienceRequirements({
      targetAudience: payload.targetAudience,
      cityName: payload.cityName ?? null,
      ageGroup: payload.ageGroup ?? null,
    });
  }
  if (payload.deliveryType === 'send_now' && payload.scheduledAt !== undefined) {
    throw validationError("Field 'scheduledAt' must be omitted when deliveryType is 'send_now'.");
  }
  if (payload.deliveryType === 'schedule_later' && payload.scheduledAt === undefined) {
    throw validationError("Field 'scheduledAt' is required when deliveryType is 'schedule_later'.");
  }
  if (payload.status === 'scheduled' && payload.deliveryType === 'send_now') {
    throw validationError("Status 'scheduled' requires deliveryType 'schedule_later'.");
  }
  if (payload.status === 'active' && payload.deliveryType === 'schedule_later') {
    throw validationError("Status 'active' requires deliveryType 'send_now'.");
  }
  return payload;
}

function optionalQueryString(value, field, { min = 0, max = Infinity } = {}) {
  if (value === undefined) {
    return null;
  }
  if (typeof value !== 'string') {
    throw validationError(`Query parameter '${field}' should be a string.`);
  }
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) {
    throw validationError(`Query parameter '${field}' length is invalid.`);
  }
  return trimmed;
}

function optionalQueryEnum(value, field, values) {
  if (value === undefined) {
    return null;
  }
  const normalized = String(value).toLowerCase();
  if (!values.has(normalized)) {
    throw validationError(`Query parameter '${field}' is invalid.`);
  }
  return normalized;
}

function optionalQueryDate(value, field) {
  if (value === undefined) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw validationError(`Query parameter '${field}' should be a valid datetime.`);
  }
  return parsed;
}

function optionalQueryNumber(value, field, { min = -Infinity, max = Infinity } = {}) {
  if (value === undefined) {
    return null;
  }
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw validationError(`Query parameter '${field}' should be a number.`);
  }
  if (parsed < min || parsed > max) {
    throw validationError(`Query parameter '${field}' is out of range.`);
  }
  return parsed;
}

export function parseNotificationCampaignFilters(query) {
  const minDeliveryRate = optionalQueryNumber(query.minDeliveryRate, 'minDeliveryRate', { min: 0, max: 100 });
  const maxDeliveryRate = optionalQueryNumber(query.maxDeliveryRate, 'maxDeliveryRate', { min: 0, max: 100 });
  if (minDeliveryRate !== null && maxDeliveryRate !== null && minDeliveryRate > maxDeliveryRate) {
    throw validationError("Query parameter 'minDeliveryRate' must be less than or equal to 'maxDeliveryRate'.");
  }
  const scheduledFrom = optionalQueryDate(query.scheduledFrom, 'scheduledFrom');
  const scheduledTo = optionalQueryDate(query.scheduledTo, 'scheduledTo');
  if (scheduledFrom !== null && scheduledTo !== null && scheduledFrom > scheduledTo) {
    throw validationError("Query parameter 'scheduledFrom' must be less than or equal to 'scheduledTo'.");
  }
  return {
    search: optionalQueryString(query.search, 'search', { min: 1, max: 120 }),
    statusFilter: optionalQueryEnum(query.status, 'status', CAMPAIGN_STATUSES),
    campaignCategory: optionalQueryEnum(query.campaignCategory, 'campaignCategory', CAMPAIGN_CATEGORIES),
    targetAudience: optionalQueryEnum(query.targetAudience, 'targetAudience', TARGET_AUDIENCES),
    deliveryType: optionalQueryEnum(query.deliveryType, 'deliveryType', DELIVERY_TYPES),
    cityName: optionalQueryString(query.cityName, 'cityName', { min: 1, max: 120 }),
    ageGroup: optionalQueryString(query.ageGroup, 'ageGroup', { min: 1, max: 50 }),
    scheduledFrom,
    scheduledTo,
    minDeliveryRate,
    maxDeliveryRate,
    sortBy: optionalQueryEnum(query.sortBy, 'sortBy', SORT_FIELDS) ?? 'createdAt',
    sortOrder: optionalQueryEnum(query.sortOrder, 'sortOrder', SORT_ORDERS) ?? 'desc',
  };
}
