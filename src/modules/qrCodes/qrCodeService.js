import { ApplicationError } from '../../core/ApplicationError.js';
import { getAuthenticatedAccount, requireActiveRoles } from '../../shared/auth/authorization.js';
import { buildQrPayload, buildQrPdfBytes, buildQrPngBytes } from '../../shared/utils/qrCode.js';

function qrResponse(record) {
  const now = new Date();
  return {
    restaurantId: record.id,
    restaurantName: record.name,
    restaurantAddress: record.address,
    restaurantCategory: record.category,
    qrCodeName: record.qrCode.name,
    qrCodeToken: record.qrCode.token,
    qrCodeLatitude: record.qrCode.location.latitude,
    qrCodeLongitude: record.qrCode.location.longitude,
    currentPackage: record.currentPackage ?? null,
    billingCycle: record.billingCycle ?? null,
    activatedAt: record.activatedAt ?? null,
    expiresAt: record.expiresAt ?? null,
    isExpired: Boolean(record.expiresAt && record.expiresAt <= now),
  };
}

export class QrCodeService {
  constructor({ restaurantRepository, userRepository, identityProvider }) {
    this.restaurantRepository = restaurantRepository;
    this.userRepository = userRepository;
    this.identityProvider = identityProvider;
  }

  async listQrCodes({ accessToken }) {
    await this.getCurrentAdmin(accessToken);
    return (await this.restaurantRepository.listAll()).map(qrResponse);
  }

  async getQrDetails({ accessToken, restaurantId }) {
    await this.getCurrentAdmin(accessToken);
    return qrResponse(await this.getRestaurantOrError(restaurantId));
  }

  async exportQrImage({ accessToken, restaurantId }) {
    await this.getCurrentAdmin(accessToken);
    const record = await this.getRestaurantOrError(restaurantId);
    return buildQrPngBytes({ payload: this.buildPrintablePayload(record) });
  }

  async exportQrPdf({ accessToken, restaurantId }) {
    await this.getCurrentAdmin(accessToken);
    const record = await this.getRestaurantOrError(restaurantId);
    return buildQrPdfBytes({ payload: this.buildPrintablePayload(record), title: record.name });
  }

  buildPrintablePayload(record) {
    return buildQrPayload({
      type: 'restaurant_check_in',
      token: record.qrCode.token,
      restaurantId: record.id,
      restaurantName: record.name,
      restaurantAddress: record.address,
      latitude: record.qrCode.location.latitude,
      longitude: record.qrCode.location.longitude,
    });
  }

  async getRestaurantOrError(restaurantId) {
    const record = await this.restaurantRepository.getById(restaurantId);
    if (!record) {
      throw new ApplicationError({
        code: 'restaurant_not_found',
        message: 'No restaurant found for the provided identifier.',
        statusCode: 404,
      });
    }
    return record;
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
      allowedRoles: new Set(['admin', 'super_admin']),
      roleErrorCode: 'admin_not_found',
      roleErrorMessage: 'No admin account found for the provided credentials.',
      blockedErrorCode: 'admin_blocked',
      blockedErrorMessage: 'The admin account is blocked.',
    });
  }
}
