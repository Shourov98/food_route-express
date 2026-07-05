import { ApplicationError } from '../../core/ApplicationError.js';
import {
  getAuthenticatedAccount,
  requireActiveRoles,
  requireVerifiedAccount,
} from '../../shared/auth/authorization.js';
import { buildReceiptUploadRecordId } from './receiptUploadRepository.js';

function receiptUploadResponse(record) {
  return {
    id: record.id,
    checkinId: record.checkinId,
    restaurantId: record.restaurantId,
    restaurantName: record.restaurantName,
    receiptImageUrl: record.receiptImageUrl,
    awardedXp: record.awardedXp,
    awardedPoints: record.awardedPoints,
    createdAt: record.createdAt,
  };
}

export class ReceiptUploadService {
  constructor({
    receiptUploadRepository,
    checkinRepository,
    restaurantRepository,
    userRepository,
    identityProvider,
    imageStorage,
    xpService,
    nowProvider = () => new Date(),
  }) {
    this.receiptUploadRepository = receiptUploadRepository;
    this.checkinRepository = checkinRepository;
    this.restaurantRepository = restaurantRepository;
    this.userRepository = userRepository;
    this.identityProvider = identityProvider;
    this.imageStorage = imageStorage;
    this.xpService = xpService;
    this.nowProvider = nowProvider;
  }

  async uploadReceipt({ accessToken, restaurantId, image }) {
    let user = await getAuthenticatedAccount({
      accessToken,
      identityProvider: this.identityProvider,
      userRepository: this.userRepository,
      notFoundCode: 'user_not_found',
      notFoundMessage: 'No end-user account found for the provided credentials.',
      notFoundStatusCode: 404,
    });
    user = requireActiveRoles({
      record: user,
      allowedRoles: new Set(['user']),
      roleErrorCode: 'user_not_found',
      roleErrorMessage: 'No end-user account found for the provided credentials.',
      roleErrorStatusCode: 404,
      blockedErrorCode: 'user_blocked',
      blockedErrorMessage: 'The user account is blocked.',
    });
    user = requireVerifiedAccount({
      record: user,
      errorCode: 'user_not_verified',
      errorMessage: 'The user account is not verified yet.',
    });

    const restaurant = await this.restaurantRepository.getById(restaurantId);
    if (!restaurant) {
      throw new ApplicationError({
        code: 'restaurant_not_found',
        message: 'No restaurant found for the provided identifier.',
        statusCode: 404,
      });
    }
    const checkin = await this.resolveLatestEligibleCheckin({
      userId: user.uid,
      restaurantId: restaurant.id,
    });

    const receiptUploadId = buildReceiptUploadRecordId();
    const stored = await this.imageStorage.uploadImage({
      folder: `receipts/${checkin.restaurantId}/${checkin.id}`,
      file: image,
    });

    const xpRecord = await this.xpService.awardXp({
      userId: user.uid,
      delta: restaurant.pointsPerReceiptUpload,
      sourceType: 'receipt_upload',
      sourceId: checkin.id,
      city: user.city || '',
      country: user.country || '',
    });
    const awardedXp = xpRecord?.xpDelta ?? 0;
    let pointsRecord = null;
    if (awardedXp > 0) {
      pointsRecord = await this.xpService.awardPoints({
        userId: user.uid,
        delta: awardedXp,
        sourceType: 'receipt_upload',
        sourceId: checkin.id,
        city: user.city || '',
        country: user.country || '',
      });
      if (!pointsRecord) {
        await this.xpService.deleteXpRecord(xpRecord.id);
        throw new ApplicationError({
          code: 'receipt_upload_failed',
          message: 'The receipt upload could not be completed right now.',
          statusCode: 500,
        });
      }
    }

    const record = {
      id: receiptUploadId,
      checkinId: checkin.id,
      userId: user.uid,
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      receiptImageUrl: stored.publicUrl,
      receiptStoragePath: stored.storagePath,
      awardedXp,
      awardedPoints: awardedXp,
      createdAt: this.nowProvider(),
    };

    try {
      const created = await this.receiptUploadRepository.create(record);
      return {
        data: receiptUploadResponse(created),
        message: 'Receipt uploaded successfully.',
      };
    } catch (error) {
      if (xpRecord) {
        await this.xpService.deleteXpRecord(xpRecord.id);
      }
      if (pointsRecord) {
        await this.xpService.deletePointsRecord(pointsRecord.id);
      }
      throw error;
    }
  }

  async resolveLatestEligibleCheckin({ userId, restaurantId }) {
    const checkins = await this.checkinRepository.listByUser(userId);
    for (const checkin of checkins) {
      if (checkin.restaurantId !== restaurantId) {
        continue;
      }
      const existingUpload = await this.receiptUploadRepository.getByCheckinId(checkin.id);
      if (!existingUpload) {
        return checkin;
      }
    }
    throw new ApplicationError({
      code: 'eligible_checkin_not_found',
      message: 'No eligible check-in was found for this restaurant.',
      statusCode: 404,
    });
  }
}
