import { defaultLimitConfig } from '~/helpers/extractLimitAndOffset';

// Kept at the model's own default so the page size of an unparameterised
// request does not change.
export const API_TOKEN_LIST_DEFAULT_LIMIT = 10;

/**
 * Pagination is the only thing a caller's query string may contribute to the
 * token list query. The remaining arguments `ApiToken.listWithCreatedBy`
 * accepts — `includeUnmappedToken`, `ssoClientId`, `tokenIds` — decide *which*
 * tokens a caller may see and are derived from the session, so spreading the
 * query into them let `?includeUnmappedToken=true` or `?ssoClientId=x` widen
 * the result set.
 */
export function extractApiTokenListQuery(query?: unknown): {
  limit: number;
  offset: number;
} {
  const q = (query ?? {}) as Record<string, unknown>;

  const rawLimit = Number(q.limit);
  const limit =
    Number.isInteger(rawLimit) && rawLimit > 0
      ? Math.min(rawLimit, defaultLimitConfig.limitMax)
      : API_TOKEN_LIST_DEFAULT_LIMIT;

  const rawOffset = Number(q.offset);
  const offset = Number.isInteger(rawOffset) && rawOffset > 0 ? rawOffset : 0;

  return { limit, offset };
}
