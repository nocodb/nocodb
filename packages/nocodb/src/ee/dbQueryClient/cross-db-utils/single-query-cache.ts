import NocoCache from '~/cache/NocoCache';
import { CacheGetType, CacheScope } from '~/utils/globals';
import { SINGLE_QUERY_DEFAULT_VIEW } from 'src/dbQueryClient/cross-db-utils/single-query-cache';
import type { NcContext } from '~/interface/config';

// Re-export so EE callers can keep a single `~/dbQueryClient/...` import.
export { SINGLE_QUERY_DEFAULT_VIEW };

/**
 * Read a cached singleQuery entry. Returns the SQL string or null.
 *
 * `setSingleQueryCache` always lands a raw string at `cacheKey`, even on
 * the cold-start path (the post-setList overwrite normalizes the shape).
 * Legacy entries written before this PR were also raw strings, so a single
 * `typeof === 'string'` check covers every shape.
 */
export async function getSingleQueryCache(
  context: NcContext,
  cacheKey: string,
): Promise<string | null> {
  const cached = await NocoCache.get(
    context,
    cacheKey,
    CacheGetType.TYPE_STRING,
  );
  return typeof cached === 'string' ? cached : null;
}

/**
 * Write a singleQuery cache entry and register it under the
 * `singleQuery:{modelId}:{viewIdOrDefault}:list` parent SET so a single
 * `deepDel(listKey, PARENT_TO_CHILD)` in `clearSingleQueryCache` wipes every
 * entry for that view — regardless of suffix combination
 * (`:queries`, `:count`, `:read:N`, `:ltar`, `:deleted`, `:primaries`,
 *  `:rls:*`, `:dvc:*`).
 *
 * Mirrors the view/column/model cache layout: setList seeds (cold start),
 * appendToList grows the parent SET (warm), deepDel invalidates.
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
  const { modelId, viewIdOrDefault, cacheKey, query } = params;
  const subListKeys = [modelId, viewIdOrDefault];

  // Write child first — appendToList's destructive fallback fires when the
  // child is missing, so ordering matters.
  await NocoCache.set(context, cacheKey, query);

  const appended = await NocoCache.appendToList(
    context,
    CacheScope.SINGLE_QUERY,
    subListKeys,
    cacheKey,
  );

  if (!appended) {
    // Cold start: the list doesn't exist yet. setList re-derives the child
    // key as `${scope}:${o.id}` and re-wraps its envelope with
    // parentKeys=[listKey] so deepDel(listKey) can later reach the child —
    // but it also overwrites the child's value with `o` itself
    // (`{ id, query }`). We immediately overwrite the value back to the
    // plain SQL string; CacheMgr.set preserves the existing parentKeys
    // from the envelope, so the list linkage survives.
    const keySuffix = cacheKey.startsWith(`${CacheScope.SINGLE_QUERY}:`)
      ? cacheKey.slice(`${CacheScope.SINGLE_QUERY}:`.length)
      : cacheKey;

    await NocoCache.setList(context, CacheScope.SINGLE_QUERY, subListKeys, [
      { id: keySuffix, query },
    ]);
    await NocoCache.set(context, cacheKey, query);
  }
}
