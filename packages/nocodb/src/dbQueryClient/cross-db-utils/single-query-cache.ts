/**
 * Sentinel used in singleQuery cache keys when the query is not scoped
 * to a specific view. Namespaced with `nc_` to avoid collision with real
 * view IDs.
 *
 * CE stub — the full implementation (cache read/write helpers) lives in
 * the EE counterpart and is only reachable from EE builds. This file
 * exists so CE-side consumers (e.g. `View.clearSingleQueryCache`) can
 * import the constant under the same path in both builds.
 */
export const SINGLE_QUERY_DEFAULT_VIEW = 'nc_default_view';
