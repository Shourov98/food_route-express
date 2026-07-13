import { validationError } from '../../core/ApplicationError.js';

export function validateCheckInScan(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw validationError('Input should be a valid dictionary or object.');
  }
  if (typeof body.qrToken !== 'string') {
    throw validationError("Field 'qrToken' is required.");
  }
  if (body.qrToken.length < 4 || body.qrToken.length > 2048) {
    throw validationError("Field 'qrToken' length is invalid.");
  }
  if (typeof body.latitude !== 'number' || Number.isNaN(body.latitude)) {
    throw validationError("Field 'latitude' is required and should be a number.");
  }
  if (body.latitude < -90 || body.latitude > 90) {
    throw validationError("Field 'latitude' is out of range.");
  }
  if (typeof body.longitude !== 'number' || Number.isNaN(body.longitude)) {
    throw validationError("Field 'longitude' is required and should be a number.");
  }
  if (body.longitude < -180 || body.longitude > 180) {
    throw validationError("Field 'longitude' is out of range.");
  }
  let accuracy = null;
  if (body.accuracy !== undefined && body.accuracy !== null) {
    if (typeof body.accuracy !== 'number' || Number.isNaN(body.accuracy)) {
      throw validationError("Field 'accuracy' should be a number.");
    }
    if (body.accuracy < 0 || body.accuracy > 10_000) {
      throw validationError("Field 'accuracy' is out of range.");
    }
    accuracy = body.accuracy;
  }
  let locationCapturedAt = null;
  if (body.locationCapturedAt !== undefined && body.locationCapturedAt !== null) {
    locationCapturedAt = new Date(body.locationCapturedAt);
    if (Number.isNaN(locationCapturedAt.getTime())) {
      throw validationError("Field 'locationCapturedAt' should be a valid date.");
    }
  }
  return {
    qrToken: body.qrToken,
    latitude: body.latitude,
    longitude: body.longitude,
    accuracy,
    locationCapturedAt,
  };
}
