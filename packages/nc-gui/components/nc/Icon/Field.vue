<script lang="ts" setup>
import { type ColumnType, isVirtualCol, UITypes } from 'nocodb-sdk'
const props = defineProps<{
  field?: ColumnType
  /**
   * Windicss color class
   */
  color?: string
  defaultUidt?: UITypes
}>()

const { field } = toRefs(props)

const injectedColumn = inject(ColumnInj, field)

const column = computed(() => field.value ?? injectedColumn.value)
</script>

<template>
  <SmartsheetHeaderVirtualCellIcon v-if="column && isVirtualCol(column)" :column-meta="column" :color="color" />
  <SmartsheetHeaderCellIcon v-else-if="column" :column-meta="column" :color="color" />
  <component v-else-if="defaultUidt" :is="getUIDTIcon(defaultUidt)" class="flex-none h-4 w-4" :class="color" />
</template>
