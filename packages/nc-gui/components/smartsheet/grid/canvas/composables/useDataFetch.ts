const MAX_RECORDS_PER_CALL = 100
const INITIAL_LOAD_SIZE = 100 // Shouldn't exceed MAX_RECORDS_PER_CALL
const CHUNK_SIZE = 50 // Shouldn't exceed MAX_RECORDS_PER_CALL
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
  // previousRowSlice to determine the scroll direction
  const previousRowSlice = ref({ start: rowSlice.value.start, end: rowSlice.value.end })

  const fetchChunk = async (chunkId: number, isInitialLoad = false) => {
    if (chunkStates.value[chunkId]) return

    const offset = chunkId * CHUNK_SIZE
    const limit = isInitialLoad ? INITIAL_LOAD_SIZE : CHUNK_SIZE

    if (offset >= totalRows.value) return

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

  // Fetch a group of contiguous chunks in one API
  const fetchChunksForGroup = async (group: number[]) => {
    if (group.length === 0) return

    const startChunk = group[0]!
    const endChunk = group[group.length - 1]!
    const offset = startChunk * CHUNK_SIZE
    const limit = (endChunk + 1) * CHUNK_SIZE - offset

    if (offset >= totalRows.value) return

    group.forEach((chunkId) => (chunkStates.value[chunkId] = 'loading'))
    try {
      const newItems = await loadData({ offset, limit })
      newItems.forEach((item) => cachedRows.value.set(item.rowMeta.rowIndex!, item))
      group.forEach((chunkId) => (chunkStates.value[chunkId] = 'loaded'))
    } catch (error) {
      console.error(`Error fetching chunks group from ${startChunk} to ${endChunk}:`, error)
      group.forEach((chunkId) => (chunkStates.value[chunkId] = undefined))
    }
  }

  const debouncedFetchChunks = useThrottleFn(
    async (chunksToFetch: Set<number>, firstChunkId: number) => {
      if (chunksToFetch.size > 0) {
        const chunks = Array.from(chunksToFetch).sort((a, b) => a - b)
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

        const maxGroupSize = Math.floor(MAX_RECORDS_PER_CALL / CHUNK_SIZE)
        for (const group of groups) {
          if (group[0] === 0 && firstChunkId === 0 && !chunkStates.value[0]) {
            await fetchChunk(0, true)
            const remainingGroup = group.filter((id) => id > 1)
            if (remainingGroup.length) {
              for (let i = 0; i < remainingGroup.length; i += maxGroupSize) {
                const subGroup = remainingGroup.slice(i, i + maxGroupSize)
                await fetchChunksForGroup(subGroup)
              }
            }
          } else {
            // If the group is larger than what we can fetch in one call
            if (group.length > maxGroupSize) {
              for (let i = 0; i < group.length; i += maxGroupSize) {
                const subGroup = group.slice(i, i + maxGroupSize)
                await fetchChunksForGroup(subGroup)
              }
            } else {
              await fetchChunksForGroup(group)
            }
          }
        }
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

    // Determine scroll direction based on previous rowSlice
    let scrollDirection: 'down' | 'up' | 'none' = 'none'
    if (start > previousRowSlice.value.start) {
      scrollDirection = 'down'
    } else if (start < previousRowSlice.value.start) {
      scrollDirection = 'up'
    }

    previousRowSlice.value = { start, end }

    const chunksToFetch = new Set<number>()

    // Always fetch the visible chunk
    for (let chunkId = firstChunkId; chunkId <= lastChunkId; chunkId++) {
      if (!chunkStates.value[chunkId]) {
        chunksToFetch.add(chunkId)
      }
    }

    // Based on the scroll direction, prefetch the next or previous chunk
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

    nextTick(triggerRefreshCanvas)

    clearCache(Math.max(0, start - BUFFER_SIZE), Math.min(totalRows.value, end + BUFFER_SIZE))

    debouncedFetchChunks(chunksToFetch, firstChunkId)
  }

  const rafId = ref<number | null>(null)
  const rafUpdateVisibleRows = () => {
    if (rafId.value) cancelAnimationFrame(rafId.value)
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
