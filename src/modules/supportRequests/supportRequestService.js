import { ApplicationError } from '../../core/ApplicationError.js';
import { getAuthenticatedAccount, requireActiveRoles } from '../../shared/auth/authorization.js';
import { buildPaginationMeta } from '../../shared/pagination.js';
import { buildSupportRequestRecordId } from './supportRequestRepository.js';

function supportRequestResponse(record) {
  return {
    id: record.id,
    title: record.title,
    message: record.message,
    status: record.status,
    createdByUid: record.createdByUid,
    createdByEmail: record.createdByEmail,
    createdByName: record.createdByName,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export class SupportRequestService {
  constructor({
    supportRequestRepository,
    userRepository,
    identityProvider,
  }) {
    this.supportRequestRepository = supportRequestRepository;
    this.userRepository = userRepository;
    this.identityProvider = identityProvider;
  }

  async createSupportRequest({ accessToken, payload }) {
    const user = await this.getCurrentUser(accessToken);
    const now = new Date();
    const record = {
      id: buildSupportRequestRecordId(),
      title: payload.title.trim(),
      message: payload.message.trim(),
      status: 'open',
      createdByUid: user.uid,
      createdByEmail: user.email,
      createdByName: user.fullname,
      createdAt: now,
      updatedAt: now,
    };
    return supportRequestResponse(await this.supportRequestRepository.create(record));
  }

  async listSupportRequests({ accessToken, page, pageSize }) {
    await this.getCurrentAdmin(accessToken);
    const records = (await this.supportRequestRepository.listAll()).sort(
      (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
    );
    const totalItems = records.length;
    const start = (page - 1) * pageSize;
    return {
      items: records.slice(start, start + pageSize).map(supportRequestResponse),
      pagination: buildPaginationMeta({ page, pageSize, totalItems }),
    };
  }

  async getSupportRequest({ accessToken, requestId }) {
    await this.getCurrentAdmin(accessToken);
    const record = await this.supportRequestRepository.getById(requestId);
    if (!record) {
      throw new ApplicationError({
        code: 'support_request_not_found',
        message: 'No support request found for the provided identifier.',
        statusCode: 404,
      });
    }
    return supportRequestResponse(record);
  }

  async getCurrentUser(accessToken) {
    const record = await getAuthenticatedAccount({
      accessToken,
      identityProvider: this.identityProvider,
      userRepository: this.userRepository,
      notFoundCode: 'user_not_found',
      notFoundMessage: 'No user account found for the provided credentials.',
      notFoundStatusCode: 404,
    });
    return requireActiveRoles({
      record,
      allowedRoles: new Set(['user', 'admin']),
      roleErrorCode: 'user_not_found',
      roleErrorMessage: 'No user account found for the provided credentials.',
      roleErrorStatusCode: 404,
      blockedErrorCode: 'user_blocked',
      blockedErrorMessage: 'The user account is blocked.',
    });
  }

  async getCurrentAdmin(accessToken) {
    const record = await getAuthenticatedAccount({
      accessToken,
      identityProvider: this.identityProvider,
      userRepository: this.userRepository,
      notFoundCode: 'admin_not_found',
      notFoundMessage: 'No admin account found for the provided credentials.',
      notFoundStatusCode: 403,
    });
    return requireActiveRoles({
      record,
      allowedRoles: new Set(['admin']),
      roleErrorCode: 'admin_not_found',
      roleErrorMessage: 'No admin account found for the provided credentials.',
      roleErrorStatusCode: 403,
      blockedErrorCode: 'admin_blocked',
      blockedErrorMessage: 'The admin account is blocked.',
    });
  }
}
