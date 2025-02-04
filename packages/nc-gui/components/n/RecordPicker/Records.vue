<script setup lang="ts">
import { type TableType, type ViewType, isCreatedOrLastModifiedTimeCol, isLinksOrLTAR, isSystemColumn } from 'nocodb-sdk'
import { searchLike } from '~/utils/searchUtils'

const props = defineProps<{
  meta: TableType
  viewMeta: ViewType
  where: string
  fields: string[]
  data: Row[]
  records: Row[]
}>()

const emits = defineEmits<{
  resolve: [Row]
}>()
const meta = toRef(props, 'meta')
const viewMeta = toRef(props, 'viewMeta')
const where = toRef(props, 'where')
const records = toRef(props, 'data')
const _Fields = toRef(props, 'fields')

const pv = computed(() => (meta.value.columns ?? []).find((c) => c.pv))

useProvideSmartsheetLtarHelpers(meta)

const computedWhere = computed(() => {
  if (!pv.value?.column_name) return ''
  return `(${pv.value.title},like,%${where.value}%)`
})

const { cachedRows, loadData, syncCount, totalRows, chunkStates, clearCache } = useInfiniteData({
  meta,
  viewMeta,
  where: computedWhere,
  callbacks: {},
  disableSmartsheet: true,
})

const _fields = computedInject(FieldsInj, (_fields) => {
  if (_Fields.value?.length) {
    return (meta.value.columns ?? []).filter(
      (col) =>
        _Fields.value.includes(col.title) &&
        !isSystemColumn(col) &&
        !isPrimary(col) &&
        !isLinksOrLTAR(col) &&
        !isCreatedOrLastModifiedTimeCol(col),
    )
  }

  return (meta.value.columns ?? [])
    .filter((col) => !isSystemColumn(col) && !isPrimary(col) && !isLinksOrLTAR(col) && !isCreatedOrLastModifiedTimeCol(col))
    .sort((a, b) => {
      return (a.meta?.defaultViewColOrder ?? Infinity) - (b.meta?.defaultViewColOrder ?? Infinity)
    })
})

const scrollWrapper = ref()

let scrollRaf = false

const scrollTop = ref(0)

const rowSlice = reactive({
  start: 0,
  end: 10,
})

const ROW_VIRTUAL_MARGIN = 5
const ROW_HEIGHT = 60

const lastTotalRows = ref(0)

const CHUNK_SIZE = 50
const BUFFER_SIZE = 100
const INITIAL_LOAD_SIZE = 100
const PREFETCH_THRESHOLD = 40

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
    newItems.forEach((item) => cachedRows.value.set(item.rowMeta.rowIndex, item))

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

const updateVisibleRows = async () => {
  if (records.value) return

  const { start, end } = rowSlice

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

  if (chunksToFetch.size > 0) {
    const isInitialLoad = firstChunkId === 0 && !chunkStates.value[0]

    if (isInitialLoad) {
      await fetchChunk(0, true)
      chunksToFetch.delete(0)
      chunksToFetch.delete(1)
    }

    await Promise.all([...chunksToFetch].map((chunkId) => fetchChunk(chunkId)))
  }

  clearCache(Math.max(0, start - BUFFER_SIZE), Math.min(totalRows.value, end + BUFFER_SIZE))
}

const calculateSlices = () => {
  // if the scrollWrapper is not rendered yet
  if (!scrollWrapper.value) {
    // try again until the grid is rendered
    setTimeout(calculateSlices, 50)
    return
  }

  const startIndex = Math.max(0, Math.floor(scrollTop.value / ROW_HEIGHT))
  const visibleCount = Math.ceil(scrollWrapper.value.clientHeight / ROW_HEIGHT)
  const endIndex = Math.min(startIndex + visibleCount, totalRows.value)

  const newStart = Math.max(0, startIndex - ROW_VIRTUAL_MARGIN)
  const newEnd = Math.min(totalRows.value, Math.max(endIndex + ROW_VIRTUAL_MARGIN, newStart + 50))

  if (
    rowSlice.start < 10 ||
    Math.abs(newStart - rowSlice.start) >= ROW_VIRTUAL_MARGIN / 2 ||
    Math.abs(newEnd - rowSlice.end) >= ROW_VIRTUAL_MARGIN / 2 ||
    lastTotalRows.value !== totalRows.value
  ) {
    rowSlice.start = newStart
    rowSlice.end = newEnd

    updateVisibleRows()
    lastTotalRows.value = totalRows.value
  }
}

const visibleRows = computed(() => {
  const { start, end } = rowSlice

  return Array.from({ length: Math.min(end, totalRows.value) - start }, (_, i) => {
    const rowIndex = start + i

    const row = cachedRows.value.get(rowIndex)

    if (!row) return { row: {}, oldRow: {}, rowMeta: { rowIndex, isLoading: true } }
    return row
  })
})

const resolve = (row: Row) => {
  emits('resolve', row)
}

useScroll(scrollWrapper, {
  onScroll: (e) => {
    if (scrollRaf) return
    scrollRaf = true
    requestAnimationFrame(() => {
      scrollTop.value = e.target?.scrollTop
      scrollRaf = false
      calculateSlices()
    })
  },
  throttle: 100,
  behavior: 'smooth',
})

watch(where, async () => {
  if (records?.value?.length) {
    const filteredRecords = searchLike(records.value, `%${where.value}%`)
    totalRows.value = filteredRecords.length
    const tempCachedRows = new Map()
    filteredRecords.forEach((row, index) => {
      tempCachedRows.set(index, {
        row,
        rowMeta: {
          rowIndex: index,
        },
      })
    })
    cachedRows.value = tempCachedRows
  } else {
    await syncCount()
    await loadData()
    calculateSlices()
    await updateVisibleRows()
  }
})

onMounted(async () => {
  if (records.value?.length) {
    records.value.forEach((row, index) => {
      cachedRows.value.set(index, {
        row,
        rowMeta: {
          rowIndex: index,
        },
      })
    })
    totalRows.value = records.value.length
  } else {
    await syncCount()
    await loadData()
    calculateSlices()
    await updateVisibleRows()
  }
})

const wrapperHeight = computed(() => {
  return totalRows.value * ROW_HEIGHT
})
</script>

<template>
  <div v-if="where && !visibleRows.length" class="px-2 py-6 pt-24 text-gray-500 flex flex-col items-center gap-6 text-center">
    <img src="~assets/img/placeholder/no-search-result-found.png" class="!w-[164px] flex-none" alt="No search results found" />

    {{ $t('title.noResultsMatchedYourSearch') }}
  </div>
  <div ref="scrollWrapper" :style="`height: ${wrapperHeight}px`" class="overflow-auto nc-scrollbar-thin">
    <div
      v-for="row in visibleRows"
      :key="row.rowMeta?.rowIndex"
      class="w-full"
      :style="{
        transform: `translateY(${rowSlice.start * ROW_HEIGHT}px)`,
      }"
    >
      <NRecordPickerItem
        :row="row"
        :fields="_fields"
        :is-loading="row?.rowMeta.isLoading"
        :display-field="pv"
        @click="resolve(row)"
      />
    </div>
  </div>
</template>
