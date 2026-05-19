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
  return { qrToken: body.qrToken };
}
