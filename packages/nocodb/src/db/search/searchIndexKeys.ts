// Search indexes are EE; EE shadows this file.

/** `meta` for a new table, without copied search index state. */
export function withoutSearchIndexState<T>(meta: T): T {
  return meta;
}
