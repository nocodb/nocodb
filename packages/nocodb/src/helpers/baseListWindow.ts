import { defaultLimitConfig } from '~/helpers/extractLimitAndOffset';

/**
 * Paging for the workspace base list is opt-in: `limit` absent means "every
 * base", which is what this endpoint has always returned. Only an explicit,
 * usable `limit` produces a window, so no existing caller is silently
 * truncated. Without one, `offset` is dropped too — there is no page to skip
 * into, and a stray offset would otherwise reach `PagedResponseImpl` and either
 * reject the request or describe the full list as a later page.
 */
export function extractBaseListWindow(query?: unknown): {
  limit?: number;
  offset: number;
} {
  const q = (query ?? {}) as Record<string, unknown>;

  const rawLimit = Number(q.limit);
  const limit =
    Number.isInteger(rawLimit) && rawLimit > 0
      ? Math.min(rawLimit, defaultLimitConfig.limitMax)
      : undefined;

  if (limit === undefined) return { limit: undefined, offset: 0 };

  const rawOffset = Number(q.offset);
  const offset = Number.isInteger(rawOffset) && rawOffset > 0 ? rawOffset : 0;

  return { limit, offset };
}

/**
 * Both base-list sources sort on `order` alone, and `Infinity - Infinity` is
 * NaN, so bases with no order keep whatever row order the database returned.
 * Stable enough for one unbounded response, not stable enough to page through.
 */
export function compareBasesForPaging(
  a: { id?: string; order?: number | null },
  b: { id?: string; order?: number | null },
): number {
  const byOrder = (a.order ?? Infinity) - (b.order ?? Infinity);
  if (byOrder) return byOrder;
  return String(a.id).localeCompare(String(b.id));
}
