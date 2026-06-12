import { SINGLE_QUERY_DEFAULT_VIEW } from 'src/dbQueryClient/cross-db-utils/single-query-cache';
import type { NcContext } from '~/interface/config';
import NocoCache from '~/cache/NocoCache';
import { CacheGetType, CacheScope } from '~/utils/globals';

// Re-export so EE callers can keep a single `~/dbQueryClient/...` import.
export { SINGLE_QUERY_DEFAULT_VIEW };

/**
 * Read a cached singleQuery entry. Returns the SQL string or null.
 */
export async function getSingleQueryCache(
  context: NcContext,
  cacheKey: string,
): Promise<string | null> {
  return NocoCache.get(context, cacheKey, CacheGetType.TYPE_STRING);
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
 *
 * `addToList` also back-links the entry to the parent SET via its `parentKeys`
 * envelope, so read-side `refreshTTL` keeps the SET alive alongside its
 * children. Without that link the SET would expire on hot tables while its
 * children live on, orphaning entries that `clearSingleQueryCache` can never
 * reach — the cause of stale compiled SQL surviving a column rename (Postgres
 * 42703 "column does not exist" on every read until a manual cache flush).
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
