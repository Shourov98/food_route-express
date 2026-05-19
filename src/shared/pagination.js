import { validationError } from '../core/ApplicationError.js';

export function parsePagination(query) {
  const page = Number(query.page ?? 1);
  const pageSize = Number(query.pageSize ?? 10);

  if (!Number.isInteger(page) || page < 1) {
    throw validationError('Input should be greater than or equal to 1.');
  }

  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw validationError('Input should be greater than or equal to 1 and less than or equal to 100.');
  }

  return { page, pageSize };
}

export function buildPaginationMeta({ page, pageSize, totalItems }) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  return {
    page,
    pageSize,
    totalItems,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}
