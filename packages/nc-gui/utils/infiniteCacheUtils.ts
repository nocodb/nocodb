/**
 * Helpers for the infinite-scroll row cache shared by the grid (canvas + legacy table),
 * gallery, kanban and shared views.
 *
 * Kept dependency-light (types only) so the pure logic can be unit-tested without the
 * Nuxt auto-import runtime.
 */

/**
 * Write freshly-fetched server rows into an infinite-scroll cache, dropping any stale
 * duplicate of the same record that may already sit at a different index.
 *
 * A record can end up cached at two indices when an optimistic structural change
 * (e.g. `clearInvalidRows` shifting rows up after a record leaves the view, or a
 * re-sort) moves it while a chunk fetch issued against the pre-shift state is still
 * in flight. When that stale fetch resolves it re-adds the record at its old index,
 * leaving the same record rendered twice at the buffer boundary (issue #9464).
 *
 * The freshly-written rows are authoritative, so any other cache entry sharing the same
 * primary key is removed first — guaranteeing the cache never holds a record twice.
 * Rows without a primary key (unsaved new rows) are left untouched.
 *
 * @param cachedRows  the index -> Row cache to mutate in place
 * @param newItems    rows just fetched/formatted from the server
 * @param getPk       extracts a stable primary key from a row's data (null when absent)
 */
export const upsertCachedRows = (
  cachedRows: Map<number, Row>,
  newItems: Row[],
  getPk: (row: Record<string, any>) => string | null,
) => {
  if (!newItems?.length) return

  const incomingPks = new Set<string>()
  const incomingIndices = new Set<number>()

  for (const item of newItems) {
    incomingIndices.add(item.rowMeta.rowIndex!)
    const pk = getPk(item.row)
    if (pk !== null && pk !== '') incomingPks.add(pk)
  }

  if (incomingPks.size) {
    for (const [index, row] of cachedRows) {
      // Indices the new rows will overwrite anyway don't need a stale-duplicate check.
      if (incomingIndices.has(index)) continue
      const pk = getPk(row.row)
      if (pk !== null && pk !== '' && incomingPks.has(pk)) {
        cachedRows.delete(index)
      }
    }
  }

  for (const item of newItems) {
    cachedRows.set(item.rowMeta.rowIndex!, item)
  }
}
