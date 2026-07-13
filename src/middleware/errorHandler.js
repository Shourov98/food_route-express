function createErrorPayload(code, message, path, details, field, requestId) {
  const error = { code, message, path };

  if (details !== undefined) {
    error.details = details;
  }

  if (field !== undefined) {
    error.field = field;
  }

  if (requestId !== undefined) {
    error.requestId = requestId;
  }

  return { success: false, error };
}

export function sendError(res, statusCode, code, message, options = {}) {
  res.status(statusCode).json(
    createErrorPayload(
      code,
      message,
      options.path,
      options.details,
      options.field,
      options.requestId,
    ),
  );
}

export function notFoundHandler(req, res) {
  sendError(res, 404, 'not_found', `Route '${req.originalUrl}' does not exist.`, {
    path: req.path,
  });
}

export function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    next(err);
    return;
  }

  const requestId = req.requestId;
  const isMalformedMultipart =
    err?.message === 'Unexpected end of form' ||
    err?.code === 'LIMIT_UNEXPECTED_FILE' ||
    err?.name === 'MulterError';
  const statusCode = isMalformedMultipart
    ? 400
    : Number.isInteger(err?.statusCode)
      ? err.statusCode
      : 500;
  const code = isMalformedMultipart
    ? 'invalid_multipart_form'
    : err?.code ?? (statusCode >= 500 ? 'internal_error' : 'http_error');
  const message = isMalformedMultipart
    ? 'Image upload could not be processed. Please choose the image again and resubmit the form.'
    : err?.message ??
      (statusCode >= 500
        ? 'Unexpected error occurred. Please contact support with requestId.'
        : 'Request could not be processed.');

  // ApplicationError instances may carry a `details` object (e.g. distance +
  // radius for check-in failures). Propagate it so the mobile client can
  // render a precise, user-facing message instead of guessing.
  const details = err?.details;

  const logPayload = {
    requestId,
    method: req.method,
    originalUrl: req.originalUrl,
    path: req.path,
    statusCode,
    code,
    message,
    details: details ?? undefined,
  };

  if (statusCode >= 500) {
    console.error('Unhandled request error', {
      ...logPayload,
      stack: err?.stack ?? null,
      name: err?.name ?? null,
    });
  } else {
    console.warn('Handled request error', logPayload);
  }

  sendError(res, statusCode, code, message, {
    requestId,
    path: req.path,
    details,
  });
}
