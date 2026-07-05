import { ApplicationError } from '../../core/ApplicationError.js';

export function validateReceiptUpload(file) {
  if (!file) {
    throw new ApplicationError({
      code: 'validation_error',
      message: "Field 'image' is required.",
      statusCode: 422,
    });
  }
  return { image: file };
}
