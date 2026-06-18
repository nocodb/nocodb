import type { Row } from '~/lib/types'

/**
 * Pure cache-manipulation helpers for the infinite-scroll grid.
 *
 * The grid caches only the chunks the user has scrolled through, keyed by their
 * ABSOLUTE position in the (server-sorted) result set: `cachedRows` is a
 * `Map<absoluteIndex, Row>`, `chunkStates[chunkIdx]` tracks whether a 50-row
 * chunk is `'loaded'` / `'loading'` / unloaded (`undefined`), and `totalRows`
 * is the server's row count.
 *
 * These functions keep that bookkeeping consistent when rows are removed,
 * inserted, or repositioned by a server-computed sort anchor. They are split out
 * (and pure — they mutate only the structures passed in, no Vue refs, no fetch)
 * so they can be unit-tested directly. `useInfiniteData` wraps them, unwrapping
 * its refs and performing the actual chunk refetch the reposition reports.
 */

export const GRID_CHUNK_SIZE = 50

export const getChunkIndex = (rowIndex: number): number => Math.floor(rowIndex / GRID_CHUNK_SIZE)

export type ChunkStates = Array<'loading' | 'loaded' | undefined>

/** Resolve a cached row's primary-key value (caller supplies the extractor). */
export type PkOf = (row: Row) => string | number | null | undefined

export interface InfiniteCacheLike {
  cachedRows: Map<number, Row>
  chunkStates: ChunkStates
  totalRows: number
}

/** Absolute index of the cached row whose pk matches `pkVal`, or -1 if absent. */
export function cacheFindRowIndexByPk(cachedRows: Map<number, Row>, pkVal: string | number, pkOf: PkOf): number {
  for (const [idx, cr] of cachedRows.entries()) {
    const p = pkOf(cr)
    if (p != null && `${p}` === `${pkVal}`) return idx
  }
  return -1
}

/**
 * Delete the row at `index` and shift every cached row AFTER it up by one, so the
 * map stays dense. Invalidates the chunk of the last shifted row (its tail slot
 * is now vacated and must refetch).
 */
export function cacheRemoveRowAt(cachedRows: Map<number, Row>, chunkStates: ChunkStates, index: number): void {
  cachedRows.delete(index)
  const toShift = Array.from(cachedRows.entries())
    .filter(([i]) => i > index)
    .sort((a, b) => a[0] - b[0])
  for (const [i, r] of toShift) {
    r.rowMeta.rowIndex = i - 1
    cachedRows.delete(i)
    cachedRows.set(i - 1, r)
  }
  if (toShift.length) {
    chunkStates[getChunkIndex(toShift[toShift.length - 1][0])] = undefined
  }
}

/**
 * Open a slot at `index` by shifting every cached row at/after it DOWN by one,
 * then place `rowObj` at `index`. Invalidates the chunk of the last shifted row.
 */
export function cacheInsertRowAt(cachedRows: Map<number, Row>, chunkStates: ChunkStates, index: number, rowObj: Row): void {
  const toShift = Array.from(cachedRows.entries())
    .filter(([i]) => i >= index)
    .sort((a, b) => b[0] - a[0])
  for (const [i, r] of toShift) {
    r.rowMeta.rowIndex = i + 1
    cachedRows.delete(i)
    cachedRows.set(i + 1, r)
  }
  rowObj.rowMeta.rowIndex = index
  cachedRows.set(index, rowObj)
  if (toShift.length) {
    chunkStates[getChunkIndex(toShift[toShift.length - 1][0])] = undefined
  }
}

export interface RepositionResult {
  /** Chunks the caller should force-refetch NOW (the row left/entered the window
   *  and the slot can only be made correct by reloading that chunk). */
  forceRefetchChunks: number[]
}

/**
 * Move row `pkVal` to sit immediately BEFORE `anchorPk` under the view's order
 * (`anchorPk === null` ⇒ the row sorts LAST). Count-neutral — an update never
 * changes the row count. Mutates `cache` in place and returns the chunks that
 * must be force-refetched (empty when fully resolved in-cache).
 *
 * Cases:
 *  - anchor in the loaded window  → reuse/materialise the row, remove from its
 *    old slot, insert before the anchor.
 *  - sorts-last, end loaded, contiguous → shift `(cur, last]` up, place at last.
 *  - sorts-last, end loaded, not contiguous (incl. row off-window) → drop the
 *    stale slot, refetch the end chunk, invalidate other loaded chunks.
 *  - anchor off-window (or sorts-last with end not loaded) → drop the row's slot
 *    and refetch its chunk (prevents a counted-but-empty "ghost" row).
 */
export function cacheRepositionByAnchor(
  cache: InfiniteCacheLike,
  opts: {
    pkVal: string | number
    payload: Record<string, any>
    anchorPk: string | null
    pkOf: PkOf
    makeRow: (payload: Record<string, any>) => Row
  },
): RepositionResult {
  const { cachedRows, chunkStates } = cache
  const { pkVal, payload, anchorPk, pkOf, makeRow } = opts

  const curIdx = cacheFindRowIndexByPk(cachedRows, pkVal, pkOf)
  const anchorIdx = anchorPk != null ? cacheFindRowIndexByPk(cachedRows, anchorPk, pkOf) : -1

  const invalidateOtherLoaded = (keepChunk: number) => {
    for (const key of Object.keys(chunkStates)) {
      const n = Number(key)
      if (n !== keepChunk && chunkStates[n] === 'loaded') chunkStates[n] = undefined
    }
  }

  if (anchorIdx === -1) {
    // Row sorts LAST → it belongs at the final position (totalRows - 1).
    if (anchorPk === null) {
      const lastIdx = cache.totalRows - 1
      if (lastIdx < 0) return { forceRefetchChunks: [] }

      // Already last → just patch in place.
      if (curIdx === lastIdx) {
        Object.assign(cachedRows.get(curIdx)!.row, payload)
        return { forceRefetchChunks: [] }
      }

      const endChunk = getChunkIndex(lastIdx)
      const endLoaded = cachedRows.has(lastIdx) || chunkStates[endChunk] === 'loaded'

      // Cache runs unbroken from the row to the end → shift in place, no refetch.
      if (curIdx !== -1 && lastIdx > curIdx) {
        let contiguousToEnd = true
        for (let i = curIdx + 1; i <= lastIdx; i++) {
          if (!cachedRows.has(i)) {
            contiguousToEnd = false
            break
          }
        }
        if (contiguousToEnd) {
          const rowObj = cachedRows.get(curIdx)!
          Object.assign(rowObj.row, payload)
          for (let i = curIdx + 1; i <= lastIdx; i++) {
            const r = cachedRows.get(i)!
            r.rowMeta.rowIndex = i - 1
            cachedRows.set(i - 1, r)
          }
          rowObj.rowMeta.rowIndex = lastIdx
          cachedRows.set(lastIdx, rowObj)
          return { forceRefetchChunks: [] }
        }
      }

      // End loaded but not shiftable in place (row off-window, or a gap before the
      // end) → drop any stale slot and refetch the end chunk so the row shows at
      // the bottom; invalidate the others for the off-by-one.
      if (endLoaded) {
        if (curIdx !== -1) cachedRows.delete(curIdx)
        invalidateOtherLoaded(endChunk)
        chunkStates[endChunk] = undefined
        return { forceRefetchChunks: [endChunk] }
      }
      // end not loaded → fall through to the generic drop+refetch below.
    }

    // Anchor off-window (or sorts-last with end not loaded): the row left the
    // visible window. Drop its slot and refetch its chunk so it doesn't leave a
    // counted-but-empty ghost; invalidate other loaded chunks for the off-by-one.
    if (curIdx !== -1) {
      const chunkId = getChunkIndex(curIdx)
      cachedRows.delete(curIdx)
      invalidateOtherLoaded(chunkId)
      chunkStates[chunkId] = undefined
      return { forceRefetchChunks: [chunkId] }
    }
    return { forceRefetchChunks: [] }
  }

  // Anchor is in the loaded window → reuse the existing Row (preserve rowMeta)
  // when cached, otherwise the row moved INTO the window — materialise it.
  const rowObj: Row =
    curIdx !== -1 ? (Object.assign(cachedRows.get(curIdx)!.row, payload), cachedRows.get(curIdx)!) : makeRow(payload)

  if (curIdx !== -1) cacheRemoveRowAt(cachedRows, chunkStates, curIdx)

  // Recompute the anchor index (the removal above may have shifted it).
  const targetIdx = cacheFindRowIndexByPk(cachedRows, anchorPk!, pkOf)
  if (targetIdx === -1) return { forceRefetchChunks: [] }
  cacheInsertRowAt(cachedRows, chunkStates, targetIdx, rowObj)
  return { forceRefetchChunks: [] }
}
