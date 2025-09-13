<script lang="ts" setup>
import { isVirtualCol } from 'nocodb-sdk'
import type { ColumnType, UITypes } from 'nocodb-sdk'
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
  <component :is="getUIDTIcon(defaultUidt)" v-else-if="defaultUidt" class="flex-none h-4 w-4" :class="color" />
</template>
