<script setup lang="ts">
import type { Row as RowType } from '#imports'
import {
  computed,
  inject,
  nextTick,
  onMounted,
  ref,
  useKanbanViewStoreOrThrow,
  useRoles,
  useSmartsheetRowStoreOrThrow,
  useSmartsheetStoreOrThrow,
} from '#imports'

const props = defineProps<{
  row: RowType
  fields: any[]
  groupField?: any
  readOnly?: boolean
  lazy?: boolean
}>()

const emit = defineEmits(['expandRecord', 'deleteRecord'])

const { isCompactMode } = useKanbanViewStoreOrThrow()

const { isUIAllowed } = useRoles()

const { meta } = useSmartsheetStoreOrThrow()

const { row } = useSmartsheetRowStoreOrThrow()

const displayField = computed(() => props.fields?.find((f) => f.pv))

const remainingFields = computed(() => props.fields?.filter((f) => !f.pv && f.visible))

const displayValue = computed(() => {
  if (displayField.value) {
    return props.row?.row?.[displayField.value.title]
  }
  return null
})
</script>

<template>
  <div
    class="nc-kanban-card"
    :class="{
      'nc-kanban-card-compact': isCompactMode,
    }"
  >
    <slot />
  </div>
</template>
