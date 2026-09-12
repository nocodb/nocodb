import { CacheScope } from '~/utils/globals';

/**
 * Sentinel used in singleQuery cache keys when the query is not scoped
 * to a specific view. Namespaced with `nc_` to avoid collision with real
 * view IDs.
 *
 * CE stub — the full implementation (cache read/write helpers) lives in
 * the EE counterpart and is only reachable from EE builds. This file
 * exists so CE-side consumers (e.g. `View.clearSingleQueryCache`) can
 * import these helpers under the same path in both builds.
 */
export const SINGLE_QUERY_DEFAULT_VIEW = 'nc_default_view';

/**
 * Redis key (a HASH) holding every compiled single-query plan for one
 * (model, view). Each plan variant — `read:{flags}…`, `queries…`, `count…`,
 * with any `:rls:*` / `:dvc:*` suffix — is a FIELD of this hash, not its own
 * key. Invalidation is therefore a single atomic `DEL` of this key
 * (`View.clearSingleQueryCache`), which cannot leave a variant stranded: there
 * is no separate index whose independent expiry/deletion could orphan the
 * entries (the cause of the Postgres 42703 "column does not exist" incident on
 * the previous SET-indexed design).
 */
export function singleQueryCacheKey(
  modelId: string,
  viewIdOrDefault: string,
): string {
  return `${CacheScope.SINGLE_QUERY}:${modelId}:${viewIdOrDefault}`;
}
