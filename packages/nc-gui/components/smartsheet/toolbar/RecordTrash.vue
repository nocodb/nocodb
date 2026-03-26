<script setup lang="ts">
const {
  isOpen,
  isLoading,
  deletedRecords,
  trashCount,
  currentPage,
  pageSize,
  totalCount,
  selectedRowIds,
  columnsMeta,
  deletedAtColumn,
  deletedByColumn,
  pkColumn,
  retentionDays,
  loadDeletedRecords,
  loadTrashCount,
  restoreRecords,
  permanentDeleteRecords,
  emptyTrash,
  openTrash,
} = useRecordTrash()
</script>

<template>
  <NcTooltip placement="bottom">
    <template #title>{{ $t('trash.title') }}</template>

    <NcButton
      v-e="['c:toolbar:record-trash']"
      size="small"
      type="text"
      class="nc-toolbar-btn nc-record-trash-btn relative"
      data-testid="nc-toolbar-record-trash-btn"
      @click="openTrash"
    >
      <div class="flex items-center gap-1">
        <GeneralIcon icon="ncTrash" class="h-4 w-4" />
        <span v-if="trashCount > 0" class="text-captionSm text-nc-content-red-dark">{{ trashCount }}</span>
      </div>
    </NcButton>
  </NcTooltip>

  <SmartsheetRecordTrashDrawer
    v-if="isOpen"
    v-model:is-open="isOpen"
    v-model:current-page="currentPage"
    v-model:selected-row-ids="selectedRowIds"
    :is-loading="isLoading"
    :deleted-records="deletedRecords"
    :trash-count="trashCount"
    :page-size="pageSize"
    :total-count="totalCount"
    :columns-meta="columnsMeta"
    :deleted-at-column="deletedAtColumn"
    :deleted-by-column="deletedByColumn"
    :pk-column="pkColumn"
    :retention-days="retentionDays"
    @load-deleted-records="loadDeletedRecords"
    @load-trash-count="loadTrashCount"
    @restore-records="restoreRecords"
    @permanent-delete-records="permanentDeleteRecords"
    @empty-trash="emptyTrash"
  />
</template>
