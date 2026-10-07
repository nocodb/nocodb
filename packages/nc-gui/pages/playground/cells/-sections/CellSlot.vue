<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'
import { isVirtualCol } from 'nocodb-sdk'
import type { Row } from '~/lib/types'

/** One cell rendered the way a given surface renders it; each slot owns a row store over the shared row. */
const props = defineProps<{
  column: ColumnType
  row: Row
  mode: 'idle' | 'edit' | 'expanded'
  readOnly?: boolean
}>()

const row = toRef(props, 'row')

const isExpanded = computed(() => props.mode === 'expanded')

const isActive = computed(() => props.mode !== 'idle')

const editEnabled = ref(props.mode !== 'idle')

const title = computed(() => props.column.title!)

provide(IsExpandedFormOpenInj, isExpanded)

provide(IsGridInj, ref(props.mode !== 'expanded'))

provide(IsFormInj, ref(false))

provide(ReloadRowDataHookInj, createEventHook())

useProvideSmartsheetRowStore(row)
</script>

<template>
  <SmartsheetDivDataCell
    class="pg-cell-slot relative flex w-full"
    :class="{
      'pg-cell-slot-idle': mode === 'idle',
      'pg-cell-slot-edit': mode === 'edit',
      'pg-cell-slot-expanded min-h-8 items-center bg-nc-bg-elevated px-1': mode === 'expanded',
      'nc-readonly-div-data-cell': mode === 'expanded' && readOnly,
    }"
  >
    <SmartsheetVirtualCell
      v-if="isVirtualCol(column)"
      v-model="row.row[title]"
      :column="column"
      :row="row"
      :active="isActive"
      :read-only="readOnly"
    />
    <SmartsheetCell
      v-else
      v-model="row.row[title]"
      v-model:edit-enabled="editEnabled"
      :column="column"
      :active="isActive"
      :read-only="readOnly"
    />
  </SmartsheetDivDataCell>
</template>

<style scoped lang="scss">
.pg-cell-slot-idle,
.pg-cell-slot-edit {
  @apply min-h-8 px-2 items-center bg-nc-bg-default;
}

.pg-cell-slot-edit {
  @apply rounded-sm;
  box-shadow: inset 0 0 0 2px var(--nc-fill-primary);
}

.pg-cell-slot-expanded {
  @apply rounded-lg border-1 border-nc-border-gray-medium;
}
</style>
