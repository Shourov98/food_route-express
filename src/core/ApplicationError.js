export class ApplicationError extends Error {
  constructor({ code, message, statusCode }) {
    super(message);
    this.name = 'ApplicationError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function validationError(message = 'Request validation failed.') {
  return new ApplicationError({
    code: 'validation_error',
    message,
    statusCode: 422,
  });
}
