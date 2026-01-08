<script setup lang="ts">
import { useDedupeOrThrow } from '../lib/useDedupe'
import RecordCard from './RecordCard.vue'

const {
  mergeState,
  contextMenuTarget,
  cachedRows,
  currentGroupRecordsPaginationData,
  currentGroup,
  totalRows,
  primaryRecordRowInfo,
  hideComputedFields,
  scrollTop,
  setPrimaryRecord,
  excludeRecord,
  syncScrollTop,
  loadData,
  syncCount,
  clearCache,
} = useDedupeOrThrow()

// Calculate all non-excluded rows (loaded or not)
const allRowIndexes = computed<number[]>(() => {
  const indexes: number[] = []
  for (let i = 0; i < totalRows.value; i++) {
    if (!mergeState.value.excludedRecordIndexes.has(i)) {
      indexes.push(i)
    }
  }
  return indexes
})

const contextMenu = ref(false)
const scrollContainer = ref<HTMLElement>()

// Record card width approximation (card width + gap between cards)
const RECORD_CARD_WIDTH = 320 + 16 // 320px card + 16px gap (gap-4)

// Virtual scrolling state
const scrollLeft = ref(0)
const visibleStartIndex = ref(0)
const visibleEndIndex = ref(16)

// Track loaded pages to avoid duplicate loading
const loadedPages = ref(new Set<number>())

// Page size from dedupe system
const PAGE_SIZE = currentGroupRecordsPaginationData.value.pageSize || 20

// Calculate container width based on total records to allow full scrolling range
const containerWidth = computed(() => {
  return allRowIndexes.value.length * RECORD_CARD_WIDTH
})

// Reset loaded pages when switching groups and preload initial data
watch(
  currentGroup,
  async () => {
    clearCache(Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY)

    loadedPages.value.clear()
    visibleStartIndex.value = 0
    visibleEndIndex.value = 20

    // Preload first few pages for better initial experience
    if (currentGroup.value) {
      currentGroupRecordsPaginationData.value.isLoading = true

      try {
        await syncCount()
      } catch (error) {
        totalRows.value = currentGroup.value.count || 0
        console.error('Failed to sync count:', error)
      }

      const initialPages = [0, 1, 2] // Load first 3 pages (60 records) initially
      const loadPromises = initialPages.map(async (pageIndex) => {
        if (pageIndex * PAGE_SIZE < totalRows.value) {
          try {
            const records = await loadData({
              limit: PAGE_SIZE,
              offset: pageIndex * PAGE_SIZE,
            })
            records.forEach((record) => {
              cachedRows.value.set(record.rowMeta.rowIndex!, record)
            })
            loadedPages.value.add(pageIndex)
          } catch (error) {
            console.error(`Failed to preload page ${pageIndex}:`, error)
          }
        }
      })
      await Promise.all(loadPromises)

      currentGroupRecordsPaginationData.value.isLoading = false
    }
  },
  { immediate: true },
)

// Calculate visible records based on scroll position
const visibleRows = computed(() => {
  const start = visibleStartIndex.value
  const end = Math.min(visibleEndIndex.value, allRowIndexes.value.length)
  return allRowIndexes.value.slice(start, end).map((rowIndex) => ({
    rowIndex,
    record: cachedRows.value.get(rowIndex) || { row: {}, oldRow: {}, rowMeta: { rowIndex, isLoading: true } },
  }))
})

// Calculate transform offset for virtual scrolling
const transformOffset = computed(() => visibleStartIndex.value * RECORD_CARD_WIDTH)

// Load data for visible range with buffer
const loadVisibleData = async () => {
  const start = Math.max(0, visibleStartIndex.value) // Add buffer before visible range
  const end = Math.min(visibleEndIndex.value, allRowIndexes.value.length) // Add buffer after visible range
  const rowIndexes = allRowIndexes.value.slice(start, end)

  const pagesToLoad = new Set<number>()
  for (const rowIndex of rowIndexes) {
    const pageIndex = Math.floor(rowIndex / PAGE_SIZE)
    if (!loadedPages.value.has(pageIndex)) {
      pagesToLoad.add(pageIndex)
    }
  }

  // Load required pages
  if (pagesToLoad.size > 0 && loadedPages.value.size) {
    const loadPromises = Array.from(pagesToLoad).map(async (pageIndex) => {
      try {
        const records = await loadData({
          limit: PAGE_SIZE,
          offset: pageIndex * PAGE_SIZE,
        })

        // Store records in cache
        records.forEach((record) => {
          cachedRows.value.set(record.rowMeta.rowIndex!, record)
        })

        loadedPages.value.add(pageIndex)
      } catch (error) {
        console.error(`Failed to load page ${pageIndex}:`, error)
      }
    })

    await Promise.all(loadPromises)
  }
}

// Handle horizontal scroll
let scrollRaf = false
const handleScroll = (event: Event) => {
  const target = event.target as HTMLElement
  if (target && !scrollRaf) {
    scrollRaf = true
    requestAnimationFrame(() => {
      const newScrollLeft = target.scrollLeft
      scrollLeft.value = newScrollLeft

      // Calculate visible range based on scroll position (actual visible + left 4 + right 4 buffer)
      const start = Math.max(0, Math.floor(newScrollLeft / RECORD_CARD_WIDTH) - 4)
      const containerWidth = target.clientWidth
      const visibleCount = Math.ceil(containerWidth / RECORD_CARD_WIDTH) + 8 // +4 for actual visible + 4 for right buffer
      const end = Math.min(start + visibleCount, allRowIndexes.value.length)

      visibleStartIndex.value = start
      visibleEndIndex.value = end

      loadVisibleData()

      // Synchronize scroll with MergePreview component
      syncScrollTop(target.scrollTop)
      scrollRaf = false
    })
  }
}

// Watch for visible range changes to load data
watch([visibleStartIndex, visibleEndIndex], loadVisibleData)

// Watch for scroll changes from the other component
watch(scrollTop, (newScrollTop) => {
  if (scrollContainer.value) {
    scrollContainer.value.scrollTop = newScrollTop
  }
})
</script>

<template>
  <div
    class="flex-1 bg-nc-bg-gray-extralight"
    :class="{
      'w-[calc(100%_-_354px)]': ncIsNumber(mergeState.primaryRecordIndex) && primaryRecordRowInfo,
      'w-full': !(ncIsNumber(mergeState.primaryRecordIndex) && primaryRecordRowInfo),
    }"
  >
    <div class="px-4 py-2 min-h-[38px] flex items-center">
      <h3 class="font-semibold m-0">Review records</h3>
      <div class="flex-1"></div>

      <div class="flex items-center gap-1">
        <NcSwitch v-model:checked="hideComputedFields"> Hide computed fields </NcSwitch>
      </div>
    </div>

    <div ref="scrollContainer" class="w-full h-[calc(100%_-_38px)] relative nc-scrollbar-thin" @scroll="handleScroll">
      <div v-if="!currentGroup" class="flex-1 h-full flex items-center justify-center">
        <a-empty description="No duplicate set selected" :image="Empty.PRESENTED_IMAGE_SIMPLE">
          <template #description>
            <span class="text-nc-content-gray-muted">Select a duplicate group to review</span>
          </template>
        </a-empty>
      </div>

      <div v-else-if="currentGroupRecordsPaginationData.isLoading" class="text-center py-8 px-4"></div>

      <div
        v-else-if="currentGroup.count && mergeState.excludedRecordIndexes.size === currentGroup.count"
        class="h-full flex items-center justify-center py-8 px-4 text-nc-content-gray-muted text-bodyLg"
      >
        All records in this set have been excluded.
      </div>

      <NcDropdown
        v-else
        v-model:visible="contextMenu"
        :disabled="contextMenuTarget === null"
        :trigger="['contextmenu']"
        overlay-class-name="nc-dropdown-dedupe-context-menu"
      >
        <template #overlay>
          <NcMenu variant="small" @click="contextMenu = false">
            <NcMenuItem
              :disabled="mergeState.primaryRecordIndex === contextMenuTarget!.index"
              @click="setPrimaryRecord(contextMenuTarget!.index)"
            >
              <GeneralIcon icon="check" />

              Use as primary record
            </NcMenuItem>
            <NcMenuItem
              :disabled="mergeState.primaryRecordIndex === contextMenuTarget!.index"
              @click="excludeRecord(contextMenuTarget!.index)"
            >
              <GeneralIcon icon="close" />

              Exclude record from set
            </NcMenuItem>
          </NcMenu>
        </template>
        <!-- Virtual scrolling container with absolute positioning -->
        <div :style="{ width: `${containerWidth}px`, height: '100%', position: 'relative' }">
          <div class="nc-review-records-container absolute top-0" :style="{ left: `${transformOffset}px` }">
            <RecordCard v-for="{ rowIndex, record } in visibleRows" :key="`record-${rowIndex}`" :record="record" />
          </div>
        </div>
      </NcDropdown>

      <general-overlay :model-value="currentGroupRecordsPaginationData.isLoading" inline transition class="!bg-opacity-15">
        <div class="flex flex-col items-center justify-center h-full w-full !bg-nc-bg-gray-extralight !bg-opacity-85 z-1000">
          <a-spin size="large" />
          <p class="text-nc-content-gray-muted mt-2">Loading records for this duplicate set...</p>
        </div>
      </general-overlay>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-review-records-container {
  @apply flex gap-4 items-stretch children:flex-none px-4 pb-4;
}
</style>
