<script lang="ts" setup>
import { type ColumnType, isVirtualCol, UITypes } from 'nocodb-sdk'
defineProps<{
  field: ColumnType
  /**
   * Windicss color class
   */
  color?: string
  defaultUidt?: UITypes
}>()
</script>

<template>
  <SmartsheetHeaderVirtualCellIcon v-if="field && isVirtualCol(field)" :column-meta="field" :color="color" />
  <SmartsheetHeaderCellIcon v-else-if="field" :column-meta="field" :color="color" />
  <component v-else-if="defaultUidt" :is="getUIDTIcon(defaultUidt)" class="flex-none h-4 w-4" :class="color" />
</template>
