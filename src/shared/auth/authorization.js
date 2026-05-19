import { ApplicationError } from '../../core/ApplicationError.js';
import { extractBearerToken } from '../../core/security.js';

export function requireBearerToken(req) {
  const token = extractBearerToken(req.headers.authorization);
  if (!token) {
    throw new ApplicationError({
      code: 'invalid_authorization_header',
      message: 'Authorization header must be in the format: Bearer <token>.',
      statusCode: 401,
    });
  }
  return token;
}

export async function getAuthenticatedAccount({
  accessToken,
  identityProvider,
  userRepository,
  notFoundCode,
  notFoundMessage,
  notFoundStatusCode,
}) {
  const identityUser = await identityProvider.verifyIdToken(accessToken);
  const record = await userRepository.getByUid(identityUser.uid);
  if (!record) {
    throw new ApplicationError({
      code: notFoundCode,
      message: notFoundMessage,
      statusCode: notFoundStatusCode,
    });
  }
  return record;
}

export function requireActiveRoles({
  record,
  allowedRoles,
  roleErrorCode,
  roleErrorMessage,
  roleErrorStatusCode = 403,
  blockedErrorCode,
  blockedErrorMessage,
}) {
  if (record.isBlocked) {
    throw new ApplicationError({
      code: blockedErrorCode,
      message: blockedErrorMessage,
      statusCode: 403,
    });
  }

  if (!allowedRoles.has(record.role)) {
    throw new ApplicationError({
      code: roleErrorCode,
      message: roleErrorMessage,
      statusCode: roleErrorStatusCode,
    });
  }

  return record;
}

export function requireVerifiedAccount({
  record,
  errorCode,
  errorMessage,
  errorStatusCode = 403,
}) {
  if (!record.isVerified) {
    throw new ApplicationError({
      code: errorCode,
      message: errorMessage,
      statusCode: errorStatusCode,
    });
  }
  return record;
}
