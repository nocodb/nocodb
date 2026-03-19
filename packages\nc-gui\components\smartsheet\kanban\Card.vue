<script lang="ts" setup>
import type { Row as RowType } from '#imports'

const props = defineProps<{
  row: RowType
  fields: ColumnType[]
  compactMode?: boolean
}>()

const emit = defineEmits(['expandRecord', 'deleteRecord'])

const { row, fields } = toRefs(props)

const { isUIAllowed } = useRoles()

const { isCompactMode: kanbanCompactMode } = useKanbanViewStore()!

const isCompact = computed(() => props.compactMode ?? kanbanCompactMode.value)

const rowId = computed(() => extractPkFromRow(row.value.row, fields.value))

function openExpandedForm() {
  emit('expandRecord', row.value)
}
</script>

<template>
  <div
    class="nc-kanban-card group relative"
    :class="{
      'nc-kanban-card-compact': isCompact,
      'nc-kanban-card-normal': !isCompact,
    }"
    @dblclick="openExpandedForm"
  >
    <template v-if="isCompact">
      <!-- Compact mode: minimal single-line display -->
      <div class="flex items-center gap-1 px-2 py-1">
        <span class="text-[13px] text-gray-800 truncate flex-1 leading-5">
          {{ row.row[fields[0]?.title] || '&nbsp;' }}
        </span>
        <div
          class="nc-kanban-card-actions opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity"
        >
          <NcButton
            type="text"
            size="xsmall"
            class="h-5 w-5 !p-0"
            @click.stop="openExpandedForm"
          >
            <GeneralIcon icon="expand" class="h-3 w-3" />
          </NcButton>
        </div>
      </div>
    </template>
    <template v-else>
      <!-- Normal mode: full card display -->
      <slot />
    </template>
  </div>
</template>
