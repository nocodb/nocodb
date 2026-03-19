<script lang="ts" setup>
import type { ColumnType, TableType } from 'nocodb-sdk'
import type { Row as RowType } from '#imports'
import { computed, inject, ref, toRefs } from '#imports'

interface Props {
  row: RowType
  allVisibleFields: ColumnType[]
  compactMode?: boolean
  readonly?: boolean
  cardColorField?: ColumnType
}

const props = withDefaults(defineProps<Props>(), {
  compactMode: false,
  readonly: false,
})

const emit = defineEmits(['expandRecord', 'deleteRecord'])

const { row, allVisibleFields, compactMode, readonly } = toRefs(props)

const { isUIAllowed } = useRoles()

const meta = inject(MetaInj, ref())

const primaryFieldValue = computed(() => {
  const primaryField = allVisibleFields.value?.find((f) => f.pv)
  if (!primaryField) return ''
  return row.value?.row?.[primaryField.title as string] ?? ''
})

function expandRecord() {
  emit('expandRecord', row.value)
}
</script>

<template>
  <div
    class="nc-kanban-data-card group relative flex flex-col bg-white border border-gray-200 rounded-lg cursor-pointer hover:shadow-md transition-all"
    :class="{
      'nc-kanban-data-card-compact !rounded !border-gray-100 hover:!border-primary': compactMode,
    }"
    @click="expandRecord"
  >
    <template v-if="compactMode">
      <!-- Compact mode: single line with primary field only -->
      <div class="flex items-center gap-1 px-2 py-[4px] min-h-[30px]">
        <span class="text-[13px] text-gray-700 truncate flex-1 leading-normal">
          {{ primaryFieldValue || '(empty)' }}
        </span>
        <NcButton
          v-if="!readonly && isUIAllowed('dataEdit')"
          type="text"
          size="xsmall"
          class="!h-5 !w-5 !p-0 !min-w-0 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
          @click.stop="expandRecord"
        >
          <GeneralIcon icon="expand" class="h-3 w-3 text-gray-400" />
        </NcButton>
      </div>
    </template>
    <template v-else>
      <!-- Normal mode -->
      <slot />
    </template>
  </div>
</template>
