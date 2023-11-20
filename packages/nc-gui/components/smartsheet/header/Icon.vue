<script lang="ts" setup>
import type { ColumnType } from 'nocodb-sdk'
import { isVirtualCol } from 'nocodb-sdk'

const { column } = defineProps<{ column: ColumnType }>()
</script>

<template>
  <SmartsheetHeaderVirtualCellIcon v-if="isVirtualCol(column)" :column-meta="column" />
  <SmartsheetHeaderCellIcon v-else :column-meta="column" />
</template>
