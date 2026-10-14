<script setup lang="ts">
import {
  computed,
  onMounted,
  ref,
  useKanbanViewStoreOrThrow,
  useSmartsheetStoreOrThrow,
  useViewColumnsOrThrow,
  useI18n,
  useNuxtApp,
} from '#imports'
import type { Row } from '~/lib/types'

const { $e } = useNuxtApp()
const { t } = useI18n()

const {
  isCompactMode,
  toggleCompactMode,
  kanbanMetaData,
  groupingField,
  groupingFieldColumn,
  stackMetaObj,
  formattedData,
  countByStack,
  deleteStack,
  updateOrSaveRow,
  addEmptyRow,
  loadMoreRecords,
} = useKanbanViewStoreOrThrow()

const { meta } = useSmartsheetStoreOrThrow()

// ── Expand record ──────────────────────────────────────────────────────────
const expandedRow = ref<Row | null>(null)
const expandedRowIndex = ref<number | null>(null)

function expandRecord(row: Row, index?: number) {
  expandedRow.value = row
  expandedRowIndex.value = index ?? null
}

function closeExpandedRecord() {
  expandedRow.value = null
  expandedRowIndex.value = null
}

// ── Computed stacks list ───────────────────────────────────────────────────
const stacks = computed(() =>
  Object.entries(formattedData.value ?? {}).map(([title, rows]) => ({
    title,
    rows: rows as Row[],
    color: stackMetaObj.value?.[title]?.color,
  })),
)
</script>

<template>
  <div class="nc-kanban-wrapper flex flex-col h-full w-full overflow-hidden">

    <!-- ── Toolbar ───────────────────────────────────────────────────────── -->
    <div class="nc-kanban-topbar flex items-center justify-between border-b border-gray-200 px-4 py-2 bg-white">
      <!-- Left: grouping info -->
      <div class="flex items-center gap-2 text-sm text-gray-500">
        <span>{{ $t('labels.groupBy') }}:</span>
        <span class="font-medium text-gray-700">{{ groupingField }}</span>
      </div>

      <!-- Right: view controls -->
      <div class="flex items-center gap-1">
        <!-- Compact mode toggle -->
        <NcTooltip placement="bottom">
          <template #title>
            {{ isCompactMode ? $t('tooltip.kanban.switchToNormal') : $t('tooltip.kanban.switchToCompact') }}
          </template>
          <NcButton
            :type="isCompactMode ? 'secondary' : 'text'"
            size="small"
            class="nc-kanban-compact-toggle"
            @click="toggleCompactMode"
          >
            <div class="flex items-center gap-1.5">
              <!-- Icon: represents row density -->
              <svg
                v-if="isCompactMode"
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <!-- Normal/comfortable rows icon -->
                <rect x="3" y="4" width="18" height="4" rx="1" />
                <rect x="3" y="10" width="18" height="4" rx="1" />
                <rect x="3" y="16" width="18" height="4" rx="1" />
              </svg>
              <svg
                v-else
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <!-- Compact rows icon -->
                <line x1="3" y1="5" x2="21" y2="5" />
                <line x1="3" y1="9" x2="21" y2="9" />
                <line x1="3" y1="13" x2="21" y2="13" />
                <line x1="3" y1="17" x2="21" y2="17" />
                <line x1="3" y1="21" x2="21" y2="21" />
              </svg>
              <span class="text-xs">
                {{ isCompactMode ? $t('labels.normalView') : $t('labels.compactView') }}
              </span>
            </div>
          </NcButton>
        </NcTooltip>
      </div>
    </div>

    <!-- ── Board ─────────────────────────────────────────────────────────── -->
    <div
      class="nc-kanban-board flex flex-1 gap-4 overflow-x-auto overflow-y-hidden"
      :class="isCompactMode ? 'p-2' : 'p-4'"
    >
      <KanbanStack
        v-for="(stack, idx) in stacks"
        :key="stack.title"
        :stack-index="idx"
        :stack-title="stack.title"
        :rows="stack.rows"
        :stack-color="stack.color"
        @expand-record="expandRecord"
      />
    </div>

    <!-- ── Row Expand Modal ───────────────────────────────────────────────── -->
    <LazySmartsheetExpandedForm
      v-if="expandedRow"
      v-model="expandedRow"
      :row="expandedRow"
      :state="expandedRow?.rowMeta?.new ? expandedRow.row : undefined"
      @close="closeExpandedRecord"
    />
  </div>
</template>

<style scoped lang="scss">
.nc-kanban-board {
  // Smooth padding transition
  transition: padding 0.2s ease;
}

// Ensure horizontal scrollbar stays visible and styled
.nc-kanban-board::-webkit-scrollbar {
  height: 8px;
}
.nc-kanban-board::-webkit-scrollbar-track {
  @apply bg-gray-100 rounded;
}
.nc-kanban-board::-webkit-scrollbar-thumb {
  @apply bg-gray-300 rounded hover:bg-gray-400;
}
</style>
