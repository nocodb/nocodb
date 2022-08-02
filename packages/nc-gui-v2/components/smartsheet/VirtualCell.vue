<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'
import { provide, useVirtualCell } from '#imports'
import { ColumnInj, ValueInj, ActiveCellInj } from '~/context'
import { NavigateDir } from '~/lib'

interface Props {
  column: ColumnType
  modelValue: any
  active?: boolean
}

const props = defineProps<Props>()
const  { column, modelValue: value,  } = props
const active = toRef(props, 'active', false)

const emit = defineEmits(['update:modelValue', 'navigate'])

provide(ColumnInj, column)
provide(ValueInj, value)
provide(ActiveCellInj, active)

const { isLookup, isBt, isRollup, isMm, isHm, isFormula, isCount } = useVirtualCell(column)
</script>

<template>
  <div
    class="nc-virtual-cell"
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

<style scoped>
.nc-hint {
  font-size: 0.61rem;
  color: grey;
}

.nc-virtual-cell {
  position: relative;
}

.nc-locked-overlay {
  position: absolute;
  z-index: 2;
  height: 100%;
  width: 100%;
  top: 0;
  left: 0;
}
</style>
