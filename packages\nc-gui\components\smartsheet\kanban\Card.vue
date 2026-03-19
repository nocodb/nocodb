<script lang="ts" setup>
import type { ColumnType } from 'nocodb-sdk'
import type { Row as RowType } from '#imports'

const props = defineProps<{
  row: RowType
  fields: ColumnType[]
  compactMode?: boolean
}>()

const emit = defineEmits(['expandRecord', 'deleteRecord'])

const { row, fields } = toRefs(props)

const { isUIAllowed } = useRoles()

const expandedFormDlg = ref(false)
const expandedFormRowState = ref()

function expandRecord() {
  emit('expandRecord', row.value)
}
</script>

<template>
  <div
    class="nc-kanban-card"
    :class="{
      'compact': compactMode,
    }"
  >
    <slot />
  </div>
</template>

<style lang="scss" scoped>
.nc-kanban-card {
  &.compact {
    // compact styles
  }
}
</style>
