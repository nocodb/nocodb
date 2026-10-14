<script lang="ts" setup>
import type { ColumnType, TableType, ViewType } from 'nocodb-sdk'
import { onMounted, ref } from '#imports'

const {
  loadKanbanData,
  loadKanbanMeta,
  kanbanViewRows,
  groupingField,
  groupingFieldColOptions,
  updateOrSaveRow,
  addEmptyRow,
  kanbanMetaData,
  isLoading,
  isKanbanDataLoading,
  activeStack,
  countByStack,
  loadMoreRows,
  isCompact,
} = useKanbanViewStore()

const { isUIAllowed } = useRoles()
const { isPublic } = useSharedView()
const { isMobileMode } = useGlobal()
const { meta: tableMeta, view: activeView } = useSmartsheetStoreOrThrow()
const { openExpandedRow } = useExpandedFormStoreOrThrow()
const { fields, coverImageField, hiddenFields, metaColumnById } = useViewColumnsOrThrow()
const { deleteRow: _deleteRow } = useViewData()

const { scrollContainer, loadMore } = useInfiniteScroll()

provide(IsKanbanInj, ref(true))

async function handleCardExpand(row: Row) {
  openExpandedRow({ row, meta: tableMeta.value as TableType, views: [] })
}

async function handleDeleteRecord(row: Row) {
  if (!isUIAllowed('dataEdit')) return
  await _deleteRow(row)
}
</script>

<template>
  <div class="nc-kanban-wrapper flex-1 overflow-x-auto">
    <div
      v-if="!isLoading && !isKanbanDataLoading"
      class="nc-kanban flex flex-row h-full gap-4 px-4 py-3"
    >
      <div
        v-for="stack in groupingFieldColOptions"
        :key="stack.id"
        class="nc-kanban-stack flex flex-col min-w-[268px] max-w-[268px]"
      >
        <!-- Stack Header -->
        <div class="nc-kanban-stack-head flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <div
              class="w-3 h-3 rounded-full flex-shrink-0"
              :style="{ backgroundColor: stack.color }"
            />
            <span class="text-sm font-semibold text-gray-700 truncate">
              {{ stack.title || 'Uncategorized' }}
            </span>
            <span class="text-xs text-gray-400">({{ countByStack.get(stack.id) || 0 }})</span>
          </div>
          <NcButton
            v-if="isUIAllowed('dataEdit') && !isPublic"
            size="xsmall"
            type="text"
            @click="addEmptyRow(stack.id)"
          >
            <GeneralIcon icon="plus" class="h-4 w-4" />
          </NcButton>
        </div>

        <!-- Cards -->
        <div
          class="nc-kanban-stack-content flex flex-col flex-1 overflow-y-auto rounded-xl"
          :class="{ 'gap-1': isCompact, 'gap-2': !isCompact }"
        >
          <KanbanCard
            v-for="(row, rowIndex) in kanbanViewRows.get(stack.id) || []"
            :key="row.rowMeta?.rowIndex || rowIndex"
            :row="row"
            :fields="fields || []"
            :cover-image-field="coverImageField"
            :grouping-field="groupingField"
            :is-public="isPublic"
            :read-only="!isUIAllowed('dataEdit')"
            :compact="isCompact"
            @expand="handleCardExpand(row)"
            @delete-record="handleDeleteRecord(row)"
          />
        </div>
      </div>
    </div>

    <div v-else class="flex items-center justify-center h-full">
      <GeneralLoader size="xlarge" />
    </div>
  </div>
</template>
