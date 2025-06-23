<script lang="ts" setup>
import { type ColumnType, isVirtualCol } from 'nocodb-sdk'
defineProps<{
  field: ColumnType
}>()
</script>

<template>
  <SmartsheetHeaderVirtualCellIcon v-if="isVirtualCol(field)" :column-meta="field" />
  <SmartsheetHeaderCellIcon v-else :column-meta="field" />
</template>
