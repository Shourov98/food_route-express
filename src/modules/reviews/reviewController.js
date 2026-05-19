import { messageResponse, successResponse } from '../../core/response.js';
import { requireBearerToken } from '../../shared/auth/authorization.js';
import { parsePagination } from '../../shared/pagination.js';
import { validateReviewCreate, validateReviewUpdate } from './reviewValidators.js';

export function createReviewController({ getReviewService, config }) {
  async function service() {
    return getReviewService(config);
  }

  return {
    async createReview(req, res) {
      const data = await (await service()).createReview({
        accessToken: requireBearerToken(req),
        restaurantId: req.params.restaurantId,
        payload: validateReviewCreate(req.body),
      });
      res.status(201).json(successResponse(data));
    },
    async listReviews(req, res) {
      const { page, pageSize } = parsePagination(req.query);
      const data = await (await service()).listReviews({
        accessToken: requireBearerToken(req),
        restaurantId: req.params.restaurantId,
        page,
        pageSize,
      });
      res.json(successResponse(data));
    },
    async updateReview(req, res) {
      const data = await (await service()).updateReview({
        accessToken: requireBearerToken(req),
        restaurantId: req.params.restaurantId,
        reviewId: req.params.reviewId,
        payload: validateReviewUpdate(req.body),
      });
      res.json(successResponse(data));
    },
    async deleteReview(req, res) {
      await (await service()).deleteReview({
        accessToken: requireBearerToken(req),
        restaurantId: req.params.restaurantId,
        reviewId: req.params.reviewId,
      });
      res.json(messageResponse('Review deleted successfully.'));
    },
  };
}
