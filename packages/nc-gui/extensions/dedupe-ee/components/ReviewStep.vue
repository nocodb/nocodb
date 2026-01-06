<script setup lang="ts">
import { useDedupeOrThrow } from '../lib/useDedupe'
import DuplicateRecordCard from './DuplicateRecordCard.vue'
import RecordCard from './RecordCard.vue'
import MergePreview from './MergePreview.vue'
import type { Row } from '#imports'

const {
  currentDuplicateSet,
  currentSetRecords,
  isLoadingCurrentSetRecords,
  availableFields,
  mergeState,
  getFieldValue,
  getSelectedFieldValue,
  setPrimaryRecord,
  excludeRecord,
  includeRecord,
  selectFieldValue,
  hasMoreSets,
  hasPreviousSets,
  findDuplicates,
  contextMenuTarget,
  cachedRows,
  totalRows,
  currentGroupRecordsPaginationData,
  currentGroup,
} = useDedupeOrThrow()

const visibleRows = computed<Row[]>(() => {
  return Array.from({ length: totalRows.value }, (_, i) => {
    const rowIndex = i
    return cachedRows.value.get(rowIndex) || { row: {}, oldRow: {}, rowMeta: { rowIndex, isLoading: true } }
  }).filter((row) => !mergeState.value.excludedRecordIndexes.has(row.rowMeta.rowIndex!))
})

const contextMenu = ref(false)
</script>

<template>
  <div class="flex flex-col h-full">
    <div v-if="!currentGroup" class="flex-1 flex items-center justify-center">
      <a-empty description="No duplicate set selected" :image="Empty.PRESENTED_IMAGE_SIMPLE">
        <template #description>
          <span class="text-nc-content-gray-muted">Select a duplicate group to review</span>
        </template>
      </a-empty>
    </div>

    <div v-else class="p-4 h-full">
      <div v-if="currentGroupRecordsPaginationData.isLoading" class="text-center py-8"></div>

      <div
        v-else-if="currentGroup.count && mergeState.excludedRecordIds.size === currentGroup.count"
        class="text-center py-8 text-nc-content-gray-muted"
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
        <div class="nc-review-records-container nc-scollbar-thin">
          <RecordCard v-for="record of visibleRows" :key="`record-${record.rowMeta.rowIndex}`" :record="record" />
        </div>
      </NcDropdown>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-review-records-container {
  @apply flex gap-4 children:flex-none;
}
</style>
