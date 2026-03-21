<script lang="ts" setup>
import type { AttachmentType, ColumnType } from 'nocodb-sdk'

interface Row {
  row: Record<string, any>
  oldRow: Record<string, any>
  rowMeta: {
    isNew?: boolean
    selected?: boolean
    [key: string]: any
  }
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

const emit = defineEmits<{
  (e: 'expand'): void
  (e: 'deleteRecord'): void
}>()

const expandRecord = () => emit('expand')
const deleteRecord = () => emit('deleteRecord')
</script>

<template>
  <div
    class="kanban-card"
    :class="{ 'kanban-card-compact': compact }"
  >
    <!-- card content -->
  </div>
</template>
