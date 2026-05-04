const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function normalizePositiveInteger(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function normalizeLimit(value, fallback = DEFAULT_LIMIT, max = MAX_LIMIT) {
  const parsed = normalizePositiveInteger(value);
  return parsed === null ? fallback : Math.min(parsed, max);
}

export function normalizePaginationParams(input = {}) {
  const rawPage = normalizePositiveInteger(input.page);
  const rawPageSize = normalizePositiveInteger(input.pageSize);
  const isPaginated = rawPage !== null || rawPageSize !== null;
  const page = rawPage ?? DEFAULT_PAGE;
  const pageSize = Math.min(rawPageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);

  return {
    isPaginated,
    page,
    pageSize,
    offset: (page - 1) * pageSize,
  };
}

export function paginateCollection(items, pagination) {
  if (!pagination?.isPaginated) {
    return {
      items,
      pagination: null,
    };
  }

  const total = items.length;
  const pagedItems = items.slice(pagination.offset, pagination.offset + pagination.pageSize);

  return {
    items: pagedItems,
    pagination: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      total,
    },
  };
}
