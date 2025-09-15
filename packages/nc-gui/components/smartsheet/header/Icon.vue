<script lang="ts" setup>
import type { ColumnType, UITypes } from 'nocodb-sdk'
import { isVirtualCol } from 'nocodb-sdk'

const props = defineProps<{
  column?: ColumnType
  /**
   * Windicss color class
   */
  color?: string
  defaultUidt?: UITypes
}>()

const { column } = toRefs(props)

const injectedColumn = inject(ColumnInj, column)

const columnMeta = computed(() => column.value ?? injectedColumn.value)
</script>

<template>
  <SmartsheetHeaderVirtualCellIcon v-if="columnMeta && isVirtualCol(columnMeta)" :column-meta="columnMeta" :color="color" />
  <SmartsheetHeaderCellIcon v-else-if="columnMeta" :column-meta="columnMeta" :color="color" />
  <component :is="getUIDTIcon(defaultUidt)" v-else-if="defaultUidt" class="flex-none h-4 w-4" :class="color" />
</template>
