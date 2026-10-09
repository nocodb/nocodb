<script setup lang="ts">
import type { Row } from '~/lib/types'
import { useKanbanViewStoreOrThrow } from '#imports'

// ── Props ──────────────────────────────────────────────────────────────────
const props = defineProps<{
  stackIndex: number
  stackTitle: string
  rows: Row[]
  stackColor?: string
}>()

const emit = defineEmits<{
  (e: 'expandRecord', row: Row): void
}>()

// ── Store ──────────────────────────────────────────────────────────────────
const { isCompactMode } = useKanbanViewStoreOrThrow()
</script>

<template>
  <div
    class="nc-kanban-stack flex flex-col rounded-xl bg-gray-50 border border-gray-200"
    :class="isCompactMode ? 'w-[220px] min-w-[220px]' : 'w-[280px] min-w-[280px]'"
  >
    <!-- ── Stack Header ────────────────────────────────────────────────────── -->
    <div
      class="nc-kanban-stack-header flex items-center justify-between rounded-t-xl px-3 py-2 font-semibold text-sm"
      :style="stackColor ? `border-top: 3px solid ${stackColor}` : ''"
    >
      <span class="truncate text-gray-700">{{ stackTitle }}</span>
      <span class="ml-2 rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-500 font-normal flex-shrink-0">
        {{ rows.length }}
      </span>
    </div>

    <!-- ── Draggable Card List ─────────────────────────────────────────────── -->
    <div
      class="nc-kanban-stack-cards flex flex-col overflow-y-auto"
      :class="isCompactMode ? 'gap-0.5 p-1.5' : 'gap-2 p-2'"
      style="max-height: calc(100vh - 220px)"
    >
      <Draggable
        :list="rows"
        :animation="150"
        item-key="row.id"
        group="kanban-cards"
        ghost-class="nc-kanban-ghost-card"
        class="flex flex-col"
        :class="isCompactMode ? 'gap-0.5' : 'gap-2'"
      >
        <template #item="{ element: row, index: cardIndex }">
          <KanbanCard
            :row="row"
            :stack-index="stackIndex"
            :card-index="cardIndex"
            @expand="emit('expandRecord', row)"
            @click="emit('expandRecord', row)"
          />
        </template>

        <!-- Empty state placeholder -->
        <template #footer>
          <div
            v-if="rows.length === 0"
            class="nc-kanban-empty-stack flex items-center justify-center text-gray-300 text-xs italic"
            :class="isCompactMode ? 'py-3' : 'py-6'"
          >
            {{ $t('labels.noRecords') }}
          </div>
        </template>
      </Draggable>
    </div>

    <!-- ── Add Record Button ──────────────────────────────────────────────── -->
    <div
      class="nc-kanban-stack-footer border-t border-gray-200 rounded-b-xl"
      :class="isCompactMode ? 'px-2 py-1' : 'px-2 py-2'"
    >
      <NcButton
        size="small"
        type="text"
        class="w-full !justify-start text-gray-500 hover:text-gray-700"
      >
        <div class="flex items-center gap-1">
          <MdiPlus class="h-4 w-4" />
          <span class="text-xs">{{ $t('general.addRecord') }}</span>
        </div>
      </NcButton>
    </div>
  </div>
</template>

<style scoped lang="scss">
.nc-kanban-ghost-card {
  @apply opacity-40 bg-primary/10 border-primary border-dashed;
}

// Smooth width transition when toggling compact/normal
.nc-kanban-stack {
  transition: width 0.2s ease, min-width 0.2s ease;
}
</style>
