import { ApplicationError } from '../../core/ApplicationError.js';
import {
  getAuthenticatedAccount,
  requireActiveRoles,
  requireVerifiedAccount,
} from '../../shared/auth/authorization.js';
import { buildPaginationMeta } from '../../shared/pagination.js';
import { buildRestaurantReviewRecordId } from './reviewRepository.js';

function reviewResponse(record) {
  return {
    id: record.id,
    restaurantId: record.restaurantId,
    userId: record.userId,
    userFullname: record.userFullname,
    userEmail: record.userEmail,
    rating: record.rating,
    comment: record.comment,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export class ReviewService {
  constructor({
    reviewRepository,
    restaurantRepository,
    userRepository,
    identityProvider,
  }) {
    this.reviewRepository = reviewRepository;
    this.restaurantRepository = restaurantRepository;
    this.userRepository = userRepository;
    this.identityProvider = identityProvider;
  }

  async createReview({ accessToken, restaurantId, payload }) {
    const user = await this.getCurrentVerifiedUser(accessToken);
    const restaurant = await this.getActiveRestaurant(restaurantId);
    const existing = await this.reviewRepository.getByUserAndRestaurant({
      userId: user.uid,
      restaurantId: restaurant.id,
    });
    if (existing) {
      throw new ApplicationError({
        code: 'review_already_exists',
        message: 'You have already reviewed this restaurant.',
        statusCode: 409,
      });
    }

    const now = new Date();
    const record = {
      id: buildRestaurantReviewRecordId(),
      restaurantId: restaurant.id,
      userId: user.uid,
      userFullname: user.fullname,
      userEmail: user.email,
      rating: payload.rating,
      comment: payload.comment,
      createdAt: now,
      updatedAt: now,
    };
    return reviewResponse(await this.reviewRepository.create(record));
  }

  async listReviews({ accessToken, restaurantId, page, pageSize }) {
    await this.getCurrentAccount(accessToken);
    await this.getActiveRestaurant(restaurantId);
    const records = await this.reviewRepository.listByRestaurant(restaurantId);
    const totalItems = records.length;
    const start = (page - 1) * pageSize;
    return {
      items: records.slice(start, start + pageSize).map(reviewResponse),
      pagination: buildPaginationMeta({ page, pageSize, totalItems }),
    };
  }

  async updateReview({ accessToken, restaurantId, reviewId, payload }) {
    const user = await this.getCurrentVerifiedUser(accessToken);
    const restaurant = await this.getActiveRestaurant(restaurantId);
    const existing = await this.getReviewOrError(reviewId);
    this.ensureReviewOwner(existing, user.uid, restaurant.id);

    const updated = {
      ...existing,
      restaurantId: restaurant.id,
      rating: payload.hasRatingField ? payload.rating : existing.rating,
      comment: payload.hasCommentField ? payload.comment : existing.comment,
      updatedAt: new Date(),
    };
    await this.reviewRepository.update(reviewId, updated);
    return reviewResponse(updated);
  }

  async deleteReview({ accessToken, restaurantId, reviewId }) {
    const user = await this.getCurrentVerifiedUser(accessToken);
    const restaurant = await this.getActiveRestaurant(restaurantId);
    const existing = await this.getReviewOrError(reviewId);
    this.ensureReviewOwner(existing, user.uid, restaurant.id);
    const deleted = await this.reviewRepository.delete(reviewId);
    if (!deleted) {
      throw new ApplicationError({
        code: 'review_not_found',
        message: 'No review found for the provided identifier.',
        statusCode: 404,
      });
    }
  }

  async getCurrentVerifiedUser(accessToken) {
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
    return requireVerifiedAccount({
      record: user,
      errorCode: 'user_not_verified',
      errorMessage: 'The user account is not verified yet.',
    });
  }

  async getCurrentAccount(accessToken) {
    const account = await getAuthenticatedAccount({
      accessToken,
      identityProvider: this.identityProvider,
      userRepository: this.userRepository,
      notFoundCode: 'account_not_found',
      notFoundMessage: 'No account found for the provided credentials.',
      notFoundStatusCode: 404,
    });
    return requireActiveRoles({
      record: account,
      allowedRoles: new Set(['user', 'admin', 'super_admin']),
      roleErrorCode: 'account_not_found',
      roleErrorMessage: 'No account found for the provided credentials.',
      roleErrorStatusCode: 404,
      blockedErrorCode: 'account_blocked',
      blockedErrorMessage: 'The account is blocked.',
    });
  }

  async getActiveRestaurant(restaurantId) {
    const restaurant = await this.restaurantRepository.getById(restaurantId);
    if (!restaurant || restaurant.status !== 'active') {
      throw new ApplicationError({
        code: 'restaurant_not_found',
        message: 'No restaurant found for the provided identifier.',
        statusCode: 404,
      });
    }
    return restaurant;
  }

  async getReviewOrError(reviewId) {
    const review = await this.reviewRepository.getById(reviewId);
    if (!review) {
      throw new ApplicationError({
        code: 'review_not_found',
        message: 'No review found for the provided identifier.',
        statusCode: 404,
      });
    }
    return review;
  }

  ensureReviewOwner(record, userId, restaurantId) {
    if (record.userId !== userId || record.restaurantId !== restaurantId) {
      throw new ApplicationError({
        code: 'review_not_found',
        message: `This review belongs to ${record.userFullname || 'another user'}.`,
        statusCode: 404,
      });
    }
  }
}
