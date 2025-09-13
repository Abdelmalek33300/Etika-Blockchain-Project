// utils/pagination.js (ESM)
export function normalizeOrder(order) {
  return (typeof order === 'string' && order.toLowerCase() === 'asc') ? 'asc' : 'desc';
}

export function compareValues(a, b, key, type = 'string', order = 'asc') {
  const dir = order === 'asc' ? 1 : -1;
  let va = a?.[key], vb = b?.[key];

  if (type === 'number') {
    va = Number(va ?? 0);
    vb = Number(vb ?? 0);
  } else if (type === 'date') {
    va = va ? new Date(va).getTime() : 0;
    vb = vb ? new Date(vb).getTime() : 0;
  } else {
    va = (va ?? '').toString().toLowerCase();
    vb = (vb ?? '').toString().toLowerCase();
  }

  if (va < vb) return -1 * dir;
  if (va > vb) return  1 * dir;
  return 0;
}

export function paginateAndSort(items, {
  page = 1,
  limit = 10,
  sort = null,
  order = 'desc',
  sortType = 'string',
  maxLimit = 100,
} = {}) {
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  const safeLimit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, maxLimit) : 10;
  const safeOrder = normalizeOrder(order);

  const src = Array.isArray(items) ? items.slice() : [];
  if (sort) {
    src.sort((a, b) => compareValues(a, b, sort, sortType, safeOrder));
  }

  const total = src.length;
  const pages = Math.max(1, Math.ceil(total / safeLimit));
  const start = (safePage - 1) * safeLimit;
  const end = start + safeLimit;

  return {
    meta: { total, page: safePage, pages, limit: safeLimit, sort, order: safeOrder },
    items: src.slice(start, end),
  };
}

// Compat défaut (permet import default OU nommé)
export default { paginateAndSort };
