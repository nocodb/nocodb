<script lang="ts" setup>
import type { ColumnType } from 'nocodb-sdk'

interface Row {
  row: Record<string, any>
  oldRow: Record<string, any>
  rowMeta: Record<string, any>
}

const props = defineProps<{
  row: Row
  fields: ColumnType[]
  coverImageField?: string
  groupingField?: ColumnType
  isPublic?: boolean
  readOnly?: boolean
  compact?: boolean
}>()

defineEmits<{
  (e: 'expand'): void
  (e: 'deleteRecord'): void
}>()
</script>

<template>
  <div class="kanban-card">
    <!-- implementation -->
  </div>
</template>
