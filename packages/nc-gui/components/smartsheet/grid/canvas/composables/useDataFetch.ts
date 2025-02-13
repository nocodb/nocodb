const INITIAL_LOAD_SIZE = 100
const CHUNK_SIZE = 50
const BUFFER_SIZE = 100
const PREFETCH_THRESHOLD = 50
const API_THROTTLE = 500

export function useDataFetch({
  chunkStates,
  cachedRows,
  clearCache,
  loadData,
  rowSlice,
  totalRows,
  triggerRefreshCanvas,
}: {
  chunkStates: Ref<Array<'loading' | 'loaded' | undefined>>
  cachedRows: Ref<Map<number, Row>>
  clearCache: (start: number, end: number) => void
  loadData: (params?: any, shouldShowLoading?: boolean) => Promise<Array<Row>>
  rowSlice: Ref<{ start: number; end: number }>
  totalRows: Ref<number>
  triggerRefreshCanvas: () => void
}) {
  const fetchChunk = async (chunkId: number, isInitialLoad = false) => {
    if (chunkStates.value[chunkId]) return

    const offset = chunkId * CHUNK_SIZE
    const limit = isInitialLoad ? INITIAL_LOAD_SIZE : CHUNK_SIZE

    if (offset >= totalRows.value) {
      return
    }

    chunkStates.value[chunkId] = 'loading'
    if (isInitialLoad) {
      chunkStates.value[chunkId + 1] = 'loading'
    }
    try {
      const newItems = await loadData({ offset, limit })
      newItems.forEach((item) => cachedRows.value.set(item.rowMeta.rowIndex!, item))

      chunkStates.value[chunkId] = 'loaded'
      if (isInitialLoad) {
        chunkStates.value[chunkId + 1] = 'loaded'
      }
    } catch (error) {
      console.error(`Error fetching chunk ${chunkId}:`, error)
      chunkStates.value[chunkId] = undefined
      if (isInitialLoad) {
        chunkStates.value[chunkId + 1] = undefined
      }
    }
  }

  const debouncedFetchChunks = useThrottleFn(
    async (chunksToFetch: Set<number>, firstChunkId: number) => {
      if (chunksToFetch.size > 0) {
        const isInitialLoad = firstChunkId === 0 && !chunkStates.value[0]
        if (isInitialLoad) {
          await fetchChunk(0, true)
          chunksToFetch.delete(0)
          chunksToFetch.delete(1)
        }
        await Promise.all([...chunksToFetch].map((chunkId) => fetchChunk(chunkId)))
      }

      nextTick(triggerRefreshCanvas)
    },
    API_THROTTLE,
    true,
  )

  const updateVisibleRows = () => {
    const { start, end } = rowSlice.value

    const firstChunkId = Math.floor(start / CHUNK_SIZE)
    const lastChunkId = Math.floor((end - 1) / CHUNK_SIZE)

    const chunksToFetch = new Set<number>()

    for (let chunkId = firstChunkId; chunkId <= lastChunkId; chunkId++) {
      if (!chunkStates.value[chunkId]) chunksToFetch.add(chunkId)
    }

    const nextChunkId = lastChunkId + 1
    if (end % CHUNK_SIZE > CHUNK_SIZE - PREFETCH_THRESHOLD && !chunkStates.value[nextChunkId]) {
      chunksToFetch.add(nextChunkId)
    }

    const prevChunkId = firstChunkId - 1
    if (prevChunkId >= 0 && start % CHUNK_SIZE < PREFETCH_THRESHOLD && !chunkStates.value[prevChunkId]) {
      chunksToFetch.add(prevChunkId)
    }

    nextTick(triggerRefreshCanvas)

    clearCache(Math.max(0, start - BUFFER_SIZE), Math.min(totalRows.value, end + BUFFER_SIZE))

    debouncedFetchChunks(chunksToFetch, firstChunkId)
  }

  const rafId = ref<number | null>(null)
  const rafUpdateVisibleRows = () => {
    if (rafId.value) {
      cancelAnimationFrame(rafId.value)
    }
    rafId.value = requestAnimationFrame(() => {
      updateVisibleRows()
      rafId.value = null
    })
  }

  return {
    fetchChunk,
    updateVisibleRows: rafUpdateVisibleRows,
  }
}
