/** Server-owned keys of `nc_models.meta` holding search index state. */
export const SEARCH_INDEX_META_KEYS = [
  'search_index',
  'search_dependents',
  'search_junction_for',
  'search_index_mode',
  'search_synced_at',
  'search_stale_since',
  'search_stale_from',
  'search_catch_up_walk',
];

/** The keys a copy drops: everything but the user-set mode. */
export const SEARCH_INDEX_STATE_KEYS = SEARCH_INDEX_META_KEYS.filter(
  (k) => k !== 'search_index_mode',
);

/** `meta` without any server-owned search key, as a client may not set them. */
export function withoutSearchIndexMeta<T>(
  meta: T,
  keys: readonly string[] = SEARCH_INDEX_META_KEYS,
): T {
  if (!meta) return meta;
  let parsed: Record<string, unknown>;
  if (typeof meta === 'string') {
    try {
      parsed = JSON.parse(meta);
    } catch {
      return meta;
    }
  } else if (typeof meta === 'object') {
    parsed = { ...(meta as Record<string, unknown>) };
  } else {
    return meta;
  }
  if (!parsed || !keys.some((k) => k in parsed)) return meta;
  for (const key of keys) delete parsed[key];
  return (typeof meta === 'string' ? JSON.stringify(parsed) : parsed) as T;
}

/**
 * `meta` for a new table (a duplicate, an import, a snapshot copy): it starts
 * with no side table, so copied state would be false. The mode carries over.
 */
export function withoutSearchIndexState<T>(meta: T): T {
  return withoutSearchIndexMeta(meta, SEARCH_INDEX_STATE_KEYS);
}
