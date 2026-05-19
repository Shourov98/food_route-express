import { validationError } from '../../core/ApplicationError.js';

function hasOwn(body, field) {
  return Object.prototype.hasOwnProperty.call(body, field);
}

function assertObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw validationError('Input should be a valid dictionary or object.');
  }
}

function optionalComment(value) {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    throw validationError('Input should be a valid string.');
  }
  if (value.length < 1 || value.length > 2000) {
    throw validationError("Field 'comment' length is invalid.");
  }
  return value;
}

function integerRating(value, { required }) {
  if (value === undefined || value === null) {
    if (required) {
      throw validationError("Field 'rating' is required.");
    }
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw validationError("Field 'rating' should be an integer.");
  }
  if (parsed < 1 || parsed > 5) {
    throw validationError("Field 'rating' is out of range.");
  }
  return parsed;
}

export function validateReviewCreate(body) {
  assertObject(body);
  return {
    rating: integerRating(body.rating, { required: true }),
    comment: optionalComment(body.comment) ?? null,
  };
}

export function validateReviewUpdate(body) {
  assertObject(body);
  return {
    rating: integerRating(body.rating, { required: false }),
    comment: hasOwn(body, 'comment') ? optionalComment(body.comment) : undefined,
    hasRatingField: hasOwn(body, 'rating'),
    hasCommentField: hasOwn(body, 'comment'),
  };
}
