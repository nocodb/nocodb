<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'
import { provide, toRef, useVirtualCell } from '#imports'
import type { Row } from '~/composables'
import { ActiveCellInj, CellValueInj, ColumnInj, RowInj } from '~/context'
import { NavigateDir } from '~/lib'

interface Props {
  column: ColumnType
  modelValue: any
  row: Row
  active?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits(['update:modelValue', 'navigate'])

const column = toRef(props, 'column')
const active = toRef(props, 'active', false)
const row = toRef(props, 'row')

provide(ColumnInj, column)
provide(ActiveCellInj, active)
provide(RowInj, row)
provide(CellValueInj, toRef(props, 'modelValue'))

const { isLookup, isBt, isRollup, isMm, isHm, isFormula, isCount } = useVirtualCell(column)
</script>

<template>
  <div
    class="nc-virtual-cell w-full"
    @keydown.stop.enter.exact="emit('navigate', NavigateDir.NEXT)"
    @keydown.stop.shift.enter.exact="emit('navigate', NavigateDir.PREV)"
  >
    <VirtualCellHasMany v-if="isHm" />
    <VirtualCellManyToMany v-else-if="isMm" />
    <VirtualCellBelongsTo v-else-if="isBt" />
    <VirtualCellRollup v-else-if="isRollup" />
    <VirtualCellFormula v-else-if="isFormula" />
    <VirtualCellCount v-else-if="isCount" />
    <VirtualCellLookup v-else-if="isLookup" />
  </div>
</template>
