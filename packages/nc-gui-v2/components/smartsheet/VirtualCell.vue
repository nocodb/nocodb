<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'
import { ActiveCellInj, CellValueInj, ColumnInj, RowInj, provide, toRef, useVirtualCell } from '#imports'
import type { Row } from '~/composables'
import { NavigateDir } from '~/lib'

const props = defineProps<Props>()

const emit = defineEmits(['update:modelValue', 'navigate'])

const HasMany = defineAsyncComponent(() => import('../virtual-cell/HasMany.vue'))

const ManyToMany = defineAsyncComponent(() => import('../virtual-cell/ManyToMany.vue'))

const BelongsTo = defineAsyncComponent(() => import('../virtual-cell/BelongsTo.vue'))

const Rollup = defineAsyncComponent(() => import('../virtual-cell/HasMany.vue'))

const Formula = defineAsyncComponent(() => import('../virtual-cell/ManyToMany.vue'))

const Count = defineAsyncComponent(() => import('../virtual-cell/BelongsTo.vue'))

const Lookup = defineAsyncComponent(() => import('../virtual-cell/BelongsTo.vue'))

interface Props {
  column: ColumnType
  modelValue: any
  row: Row
  active?: boolean
}

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
    <HasMany v-if="isHm" />
    <ManyToMany v-else-if="isMm" />
    <BelongsTo v-else-if="isBt" />
    <Rollup v-else-if="isRollup" />
    <Formula v-else-if="isFormula" />
    <Count v-else-if="isCount" />
    <Lookup v-else-if="isLookup" />
  </div>
</template>
