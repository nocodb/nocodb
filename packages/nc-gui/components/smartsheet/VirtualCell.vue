<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'
import { ActiveCellInj, CellValueInj, ColumnInj, IsFormInj, RowInj, inject, provide, ref, toRef, useVirtualCell } from '#imports'
import type { Row } from '~/lib'
import { NavigateDir } from '~/lib'

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

const isForm = inject(IsFormInj, ref(false))

const virtualCell = useVirtualCell(column)

function onNavigate(dir: NavigateDir, e: KeyboardEvent) {
  emit('navigate', dir)

  if (!isForm.value) e.stopImmediatePropagation()
}
</script>

<template>
  <div
    class="nc-virtual-cell w-full"
    @keydown.enter.exact="onNavigate(NavigateDir.NEXT, $event)"
    @keydown.shift.enter.exact="onNavigate(NavigateDir.PREV, $event)"
  >
    <component :is="virtualCell" />
  </div>
</template>
