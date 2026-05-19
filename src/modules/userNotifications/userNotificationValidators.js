import { validationError } from '../../core/ApplicationError.js';

const CATEGORIES = new Set(['all', 'points', 'rewards', 'challenges', 'promotions', 'location']);

export function parseNotificationListQuery(query) {
  let category = null;
  if (query.category !== undefined) {
    category = String(query.category).toLowerCase();
    if (!CATEGORIES.has(category)) {
      throw validationError("Query parameter 'category' is invalid.");
    }
  }

  let limit = 4;
  if (query.limit !== undefined) {
    limit = Number(query.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 20) {
      throw validationError("Query parameter 'limit' should be greater than or equal to 1 and less than or equal to 20.");
    }
  }

  return { category, limit };
}
