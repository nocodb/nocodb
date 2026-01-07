<script setup lang="ts">
import { useDedupeOrThrow } from '../lib/useDedupe'
import RecordCard from './RecordCard.vue'
import type { Row } from '#imports'

const {
  mergeState,
  contextMenuTarget,
  cachedRows,
  currentGroupRecordsPaginationData,
  currentGroup,
  totalRows,
  primaryRecordRowInfo,
  setPrimaryRecord,
  excludeRecord,
  scrollTop,
  syncScrollTop,
} = useDedupeOrThrow()

const visibleRows = computed<Row[]>(() => {
  return Array.from({ length: totalRows.value }, (_, i) => {
    const rowIndex = i
    return cachedRows.value.get(rowIndex) || { row: {}, oldRow: {}, rowMeta: { rowIndex, isLoading: true } }
  }).filter((row) => !mergeState.value.excludedRecordIndexes.has(row.rowMeta.rowIndex!))
})

const contextMenu = ref(false)
const scrollContainer = ref<HTMLElement>()

// Synchronize scroll with MergePreview component
const handleScroll = (event: Event) => {
  const target = event.target as HTMLElement
  if (target) {
    syncScrollTop(target.scrollTop)
  }
}

// Watch for scroll changes from the other component
watch(scrollTop, (newScrollTop) => {
  if (scrollContainer.value) {
    scrollContainer.value.scrollTop = newScrollTop
  }
})
</script>

<template>
  <div
    class="flex-1 w-full bg-nc-bg-gray-extralight"
    :class="{
      '!w-[calc(100%_-_354px)]': ncIsNumber(mergeState.primaryRecordIndex) && primaryRecordRowInfo,
    }"
  >
    <div class="px-4 py-2 min-h-[38px]">
      <h3 class="font-semibold m-0">Review records</h3>
    </div>

    <div ref="scrollContainer" class="w-full h-[calc(100%_-_38px)] relative nc-scrollbar-thin" @scroll="handleScroll">
      <div v-if="!currentGroup" class="flex-1 flex items-center justify-center">
        <a-empty description="No duplicate set selected" :image="Empty.PRESENTED_IMAGE_SIMPLE">
          <template #description>
            <span class="text-nc-content-gray-muted">Select a duplicate group to review</span>
          </template>
        </a-empty>
      </div>

      <div v-else-if="currentGroupRecordsPaginationData.isLoading" class="text-center py-8 px-4"></div>

      <div
        v-else-if="currentGroup.count && mergeState.excludedRecordIds.size === currentGroup.count"
        class="text-center py-8 px-4 text-nc-content-gray-muted"
      >
        All records in this set have been excluded.
      </div>

      <NcDropdown
        v-model:visible="contextMenu"
        :disabled="contextMenuTarget === null"
        :trigger="['contextmenu']"
        overlay-class-name="nc-dropdown-dedupe-context-menu"
      >
        <template #overlay>
          <NcMenu variant="small" @click="contextMenu = false">
            <NcMenuItem
              @click="setPrimaryRecord(contextMenuTarget!.index)"
              :disabled="mergeState.primaryRecordIndex === contextMenuTarget!.index"
            >
              <GeneralIcon icon="check" />

              Use as primary record
            </NcMenuItem>
            <NcMenuItem
              @click="excludeRecord(contextMenuTarget!.index)"
              :disabled="mergeState.primaryRecordIndex === contextMenuTarget!.index"
            >
              <GeneralIcon icon="close" />

              Exclude record from set
            </NcMenuItem>
          </NcMenu>
        </template>
        <div class="nc-review-records-container nc-scollbar-thin relative">
          <RecordCard v-for="(record, idx) of visibleRows" :key="`record-${idx}`" :record="record" />

          <div>
            <!-- Just for spacing  -->
            &nbsp
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
  @apply flex gap-4 children:flex-none px-4 pb-4;
}
</style>
