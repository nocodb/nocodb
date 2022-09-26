<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'
import {
  ActiveCellInj,
  CellValueInj,
  ColumnInj,
  RowInj,
  computed,
  isBt,
  isCount,
  isFormula,
  isHm,
  isLookup,
  isMm,
  isRollup,
  provide,
  toRef,
} from '#imports'
import type { Row } from '~/lib'
import { NavigateDir } from '~/lib'
import HasMany from '~/components/virtual-cell/HasMany.vue'
import ManyToMany from '~/components/virtual-cell/ManyToMany.vue'
import BelongsTo from '~/components/virtual-cell/BelongsTo.vue'
import Lookup from '~/components/virtual-cell/Lookup.vue'
import Rollup from '~/components/virtual-cell/Rollup.vue'
import Formula from '~/components/virtual-cell/Formula.vue'
import Count from '~/components/virtual-cell/Count.vue'

const props = defineProps<{
  column: ColumnType
  modelValue: any
  row: Row
  active?: boolean
}>()

const emit = defineEmits(['update:modelValue', 'navigate'])

const column = toRef(props, 'column')
const active = toRef(props, 'active', false)
const row = toRef(props, 'row')

provide(ColumnInj, column)
provide(ActiveCellInj, active)
provide(RowInj, row)
provide(CellValueInj, toRef(props, 'modelValue'))

const virtualCell = computed(() => {
  if (!column.value) return null

  if (isHm(column.value)) return HasMany
  if (isMm(column.value)) return ManyToMany
  if (isBt(column.value)) return BelongsTo
  if (isLookup(column.value)) return Lookup
  if (isRollup(column.value)) return Rollup
  if (isFormula(column.value)) return Formula
  if (isCount(column.value)) return Count
})
</script>

<template>
  <div
    class="nc-virtual-cell w-full"
    @keydown.stop.enter.exact="emit('navigate', NavigateDir.NEXT)"
    @keydown.stop.shift.enter.exact="emit('navigate', NavigateDir.PREV)"
  >
    <component :is="virtualCell" />
  </div>
</template>
