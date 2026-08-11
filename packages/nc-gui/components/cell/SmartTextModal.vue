<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'

interface Props {
  visible: boolean
  tableId?: string | null
  rowId?: string | null
  columnId?: string | null
  columnTitle?: string | null
  column?: ColumnType | null
  readOnly?: boolean
  isNewRecord?: boolean
  draftContent?: Record<string, any> | null
  initialMarkdown?: string | null
}

defineProps<Props>()

defineEmits<{
  (e: 'update:visible', val: boolean): void
  (e: 'saved', markdown: string | null): void
  (e: 'update:draftContent', pm: Record<string, any> | null): void
}>()
</script>

<template>
  <NcSpanHidden />
</template>
