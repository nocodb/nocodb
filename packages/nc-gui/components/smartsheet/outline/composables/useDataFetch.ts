/**
 * useOutlineDataFetch — Chunked data loading for the outline view canvas.
 *
 * The outline view API (`outlineViewDataList`) supports offset/limit pagination.
 * The count API (`outlineViewDataCount`) returns totalRows + per-model counts.
 *
 * Both endpoints accept a `collapsed` param (JSON) so the server
 * only returns expanded rows — collapsed subtrees are skipped server-side.
 *
 * This composable adapts the grid canvas's useDataFetch pattern:
 * - Chunked loading with prefetch
 * - Scroll-direction-aware prefetching
 * - Throttled API calls
 */

import type { OutlineViewRow } from '~/composables/useOutlineViewStore'

const CHUNK_SIZE = 50
const INITIAL_LOAD_SIZE = 100
const BUFFER_SIZE = 100
const PREFETCH_THRESHOLD = 25
const API_THROTTLE = 500

export function useOutlineDataFetch({
  viewId,
  cachedRows,
  chunkStates,
  totalRows,
  levelCounts,
  collapsedJson,
  loadPage,
  loadCount,
  triggerRefreshCanvas,
}: {
  /** Current view ID */
  viewId: ComputedRef<string | undefined>
  /** Row cache: index → row data */
  cachedRows: Ref<Map<number, OutlineViewRow>>
  /** Chunk state tracking */
  chunkStates: Ref<Array<'loading' | 'loaded' | undefined>>
  /** Total visible row count (from count endpoint) */
  totalRows: Ref<number>
  /** Per-model counts from count endpoint: { modelId: count } */
  levelCounts: Ref<Record<string, number>>
  /** Serialized collapsed state for API calls */
  collapsedJson: ComputedRef<string>
  /** Fetch a page of data */
  loadPage: (params: { offset: number; limit: number; collapsed: string }) => Promise<OutlineViewRow[]>
  /** Fetch total count */
  loadCount: (params: { collapsed: string }) => Promise<{ totalRows: number; counts: Record<string, number> }>
  /** Trigger canvas re-render */
  triggerRefreshCanvas: () => void
}) {
  const previousRowSlice = ref({ start: 0, end: 0 })

  // -------------------------------------------------------------------
  // Fetch count
  // -------------------------------------------------------------------
  async function fetchCount() {
    if (!viewId.value) return

    try {
      const result = await loadCount({ collapsed: collapsedJson.value })
      totalRows.value = result.totalRows
      levelCounts.value = result.counts
    } catch (e) {
      console.error('Error fetching outline view count:', e)
    }
  }

  // -------------------------------------------------------------------
  // Fetch a single chunk
  // -------------------------------------------------------------------
  async function fetchChunk(chunkId: number, isInitialLoad = false) {
    if (chunkStates.value[chunkId]) return

    const offset = chunkId * CHUNK_SIZE
    const limit = isInitialLoad ? INITIAL_LOAD_SIZE : CHUNK_SIZE

    if (offset >= totalRows.value) return

    chunkStates.value[chunkId] = 'loading'
    if (isInitialLoad) {
      chunkStates.value[chunkId + 1] = 'loading'
    }

    try {
      const rows = await loadPage({
        offset,
        limit,
        collapsed: collapsedJson.value,
      })

      rows.forEach((row, idx) => {
        cachedRows.value.set(offset + idx, row)
      })

      chunkStates.value[chunkId] = 'loaded'
      if (isInitialLoad) {
        chunkStates.value[chunkId + 1] = 'loaded'
      }
    } catch (e) {
      console.error(`Error fetching outline chunk ${chunkId}:`, e)
      chunkStates.value[chunkId] = undefined
      if (isInitialLoad) {
        chunkStates.value[chunkId + 1] = undefined
      }
    }
  }

  // -------------------------------------------------------------------
  // Fetch contiguous chunk group in one API call
  // -------------------------------------------------------------------
  async function fetchChunkGroup(group: number[]) {
    if (group.length === 0) return

    const startChunk = group[0]!
    const endChunk = group[group.length - 1]!
    const offset = startChunk * CHUNK_SIZE
    const limit = (endChunk + 1) * CHUNK_SIZE - offset

    if (offset >= totalRows.value) return

    group.forEach((id) => (chunkStates.value[id] = 'loading'))

    try {
      const rows = await loadPage({
        offset,
        limit,
        collapsed: collapsedJson.value,
      })

      rows.forEach((row, idx) => {
        cachedRows.value.set(offset + idx, row)
      })

      group.forEach((id) => (chunkStates.value[id] = 'loaded'))
    } catch (e) {
      console.error(`Error fetching outline chunks ${startChunk}-${endChunk}:`, e)
      group.forEach((id) => (chunkStates.value[id] = undefined))
    }
  }

  // -------------------------------------------------------------------
  // Throttled batch fetcher
  // -------------------------------------------------------------------
  const debouncedFetchChunks = useThrottleFn(
    async (chunksToFetch: Set<number>, firstChunkId: number) => {
      if (chunksToFetch.size === 0) return

      const chunks = Array.from(chunksToFetch).sort((a, b) => a - b)

      // Group contiguous chunks
      const groups: number[][] = []
      let currentGroup: number[] = [chunks[0]!]

      for (let i = 1; i < chunks.length; i++) {
        if (chunks[i] === chunks[i - 1]! + 1) {
          currentGroup.push(chunks[i]!)
        } else {
          groups.push(currentGroup)
          currentGroup = [chunks[i]!]
        }
      }
      groups.push(currentGroup)

      const maxGroupSize = Math.floor(200 / CHUNK_SIZE) // API max limit is 200

      for (const group of groups) {
        if (group[0] === 0 && firstChunkId === 0 && !chunkStates.value[0]) {
          await fetchChunk(0, true)
          const remaining = group.filter((id) => id > 1)
          if (remaining.length) {
            for (let i = 0; i < remaining.length; i += maxGroupSize) {
              await fetchChunkGroup(remaining.slice(i, i + maxGroupSize))
            }
          }
        } else if (group.length > maxGroupSize) {
          for (let i = 0; i < group.length; i += maxGroupSize) {
            await fetchChunkGroup(group.slice(i, i + maxGroupSize))
          }
        } else {
          await fetchChunkGroup(group)
        }
      }

      nextTick(triggerRefreshCanvas)
    },
    API_THROTTLE,
    true,
  )

  // -------------------------------------------------------------------
  // Update visible rows — called on scroll
  // -------------------------------------------------------------------
  function updateVisibleRows(rowSlice: { start: number; end: number }) {
    const { start, end } = rowSlice
    const firstChunkId = Math.floor(start / CHUNK_SIZE)
    const lastChunkId = Math.floor(Math.max(0, end - 1) / CHUNK_SIZE)

    // Scroll direction
    let scrollDirection: 'down' | 'up' | 'none' = 'none'
    if (start > previousRowSlice.value.start) scrollDirection = 'down'
    else if (start < previousRowSlice.value.start) scrollDirection = 'up'
    previousRowSlice.value = { start, end }

    const chunksToFetch = new Set<number>()

    // Visible chunks
    for (let chunkId = firstChunkId; chunkId <= lastChunkId; chunkId++) {
      if (!chunkStates.value[chunkId]) {
        chunksToFetch.add(chunkId)
      }
    }

    // Prefetch based on scroll direction
    if (scrollDirection === 'down' || scrollDirection === 'none') {
      const nextChunkId = lastChunkId + 1
      if (end % CHUNK_SIZE > CHUNK_SIZE - PREFETCH_THRESHOLD && !chunkStates.value[nextChunkId]) {
        chunksToFetch.add(nextChunkId)
      }
    } else if (scrollDirection === 'up') {
      const prevChunkId = firstChunkId - 1
      if (prevChunkId >= 0 && start % CHUNK_SIZE < PREFETCH_THRESHOLD && !chunkStates.value[prevChunkId]) {
        chunksToFetch.add(prevChunkId)
      }
    }

    // Evict out-of-buffer rows
    clearCache(Math.max(0, start - BUFFER_SIZE), Math.min(totalRows.value, end + BUFFER_SIZE))

    debouncedFetchChunks(chunksToFetch, firstChunkId)
  }

  // -------------------------------------------------------------------
  // Clear rows outside the buffer window
  // -------------------------------------------------------------------
  function clearCache(keepStart: number, keepEnd: number) {
    const affectedChunks = new Set<number>()

    for (const [idx] of cachedRows.value) {
      if (idx < keepStart || idx >= keepEnd) {
        cachedRows.value.delete(idx)
        affectedChunks.add(Math.floor(idx / CHUNK_SIZE))
      }
    }

    // Reset chunkStates for evicted chunks so they get re-fetched when scrolled back
    for (const chunkId of affectedChunks) {
      chunkStates.value[chunkId] = undefined
    }
  }

  // -------------------------------------------------------------------
  // Reset — call when collapsed state changes (server re-query needed)
  // Does NOT clear old cache — stale rows are naturally evicted by
  // updateVisibleRows and overwritten by new fetches, avoiding flicker.
  // -------------------------------------------------------------------
  async function resetAndReload() {
    chunkStates.value = []

    await fetchCount()

    if (totalRows.value > 0) {
      await fetchChunk(0, true)
    }

    nextTick(triggerRefreshCanvas)
  }

  return {
    fetchCount,
    fetchChunk,
    updateVisibleRows,
    resetAndReload,
    clearCache,
  }
}
