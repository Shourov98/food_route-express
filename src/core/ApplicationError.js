export class ApplicationError extends Error {
  constructor({ code, message, statusCode, details }) {
    super(message);
    this.name = 'ApplicationError';
    this.code = code;
    this.statusCode = statusCode;
    if (details !== undefined) {
      this.details = details;
    }
  }
}

export function validationError(message = 'Request validation failed.', details) {
  return new ApplicationError({
    code: 'validation_error',
    message,
    statusCode: 422,
    details,
  });
}
