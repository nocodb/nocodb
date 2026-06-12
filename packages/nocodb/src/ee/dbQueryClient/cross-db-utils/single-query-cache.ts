import { SINGLE_QUERY_DEFAULT_VIEW } from 'src/dbQueryClient/cross-db-utils/single-query-cache';
import type { NcContext } from '~/interface/config';
import NocoCache from '~/cache/NocoCache';
import { CacheGetType, CacheScope } from '~/utils/globals';

// Re-export so EE callers can keep a single `~/dbQueryClient/...` import.
export { SINGLE_QUERY_DEFAULT_VIEW };

/**
 * Read a cached singleQuery entry. Returns the SQL string or null.
 *
 * Serves the entry only while it is still registered under the
 * `singleQuery:{modelId}:{viewIdOrDefault}:list` parent SET — i.e. while
 * `clearSingleQueryCache` can still reach it. If the SET is gone (TTL expiry,
 * eviction) the entry is an orphan that schema-change invalidation can never
 * clear; serving it would keep executing SQL compiled against a stale schema
 * (e.g. a renamed physical column → Postgres 42703 on every read). Drop the
 * orphan and report a miss so the caller rebuilds and re-registers it.
 */
export async function getSingleQueryCache(
  context: NcContext,
  params: {
    modelId: string;
    viewIdOrDefault: string;
    cacheKey: string;
  },
): Promise<string | null> {
  const { modelId, viewIdOrDefault, cacheKey } = params;
  const [isRegistered, cached] = await Promise.all([
    NocoCache.isInList(
      context,
      CacheScope.SINGLE_QUERY,
      [modelId, viewIdOrDefault],
      cacheKey,
    ),
    NocoCache.get(context, cacheKey, CacheGetType.TYPE_STRING),
  ]);

  if (!isRegistered) {
    if (cached) {
      await NocoCache.del(context, cacheKey);
    }
    return null;
  }

  return cached;
}

/**
 * Write a singleQuery cache entry and register it under the
 * `singleQuery:{modelId}:{viewIdOrDefault}:list` parent SET so a single
 * `deepDel(listKey, PARENT_TO_CHILD)` in `clearSingleQueryCache` wipes every
 * entry for that view — regardless of suffix combination
 * (`:queries`, `:count`, `:read:N`, `:ltar`, `:deleted`, `:primaries`,
 *  `:rls:*`, `:dvc:*`).
 *
 * Uses `addToList` (sadd) instead of `appendToList`/`setList` so concurrent
 * writers for the same (model, view) but different suffixes (e.g. `:queries`
 * and `:count` racing through `Promise.all` in `getDataWithCountCache`) each
 * add their own member without wiping siblings.
 */
export async function setSingleQueryCache(
  context: NcContext,
  params: {
    modelId: string;
    viewIdOrDefault: string;
    cacheKey: string;
    query: string;
  },
): Promise<void> {
  await NocoCache.set(context, params.cacheKey, params.query);
  await NocoCache.addToList(
    context,
    CacheScope.SINGLE_QUERY,
    [params.modelId, params.viewIdOrDefault],
    params.cacheKey,
  );
}
