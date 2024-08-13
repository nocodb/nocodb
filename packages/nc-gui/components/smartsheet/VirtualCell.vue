<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'
import { isCreatedOrLastModifiedByCol, isCreatedOrLastModifiedTimeCol } from 'nocodb-sdk'

const props = defineProps<{
  column: ColumnType
  modelValue: any
  row?: Row
  active?: boolean
  readOnly?: boolean
}>()

const emit = defineEmits(['update:modelValue', 'navigate', 'save'])

const column = toRef(props, 'column')
const active = toRef(props, 'active', false)
const row = toRef(props, 'row')
const readOnly = toRef(props, 'readOnly', false)

provide(ColumnInj, column)
provide(ActiveCellInj, active)
provide(RowInj, row)
provide(CellValueInj, toRef(props, 'modelValue'))
provide(SaveRowInj, () => emit('save'))
provide(ReadonlyInj, readOnly)

const isGrid = inject(IsGridInj, ref(false))

const isForm = inject(IsFormInj, ref(false))

const isExpandedForm = inject(IsExpandedFormOpenInj, ref(false))

function onNavigate(dir: NavigateDir, e: KeyboardEvent) {
  emit('navigate', dir)

  if (!isForm.value) e.stopImmediatePropagation()
}
</script>

<template>
  <div
    class="nc-virtual-cell w-full flex items-center"
    :class="[
      `nc-virtual-cell-${(column.uidt || 'default').toLowerCase()}`,
      {
        'text-right justify-end': isGrid && !isForm && isRollup(column) && !isExpandedForm,
        'nc-display-value-cell': isPrimary(column) && !isForm,
      },
    ]"
    @keydown.enter.exact="onNavigate(NavigateDir.NEXT, $event)"
    @keydown.shift.enter.exact="onNavigate(NavigateDir.PREV, $event)"
  >
    <LazyVirtualCellLinks v-if="isLink(column)" />
    <LazyVirtualCellHasMany v-else-if="isHm(column)" />
    <LazyVirtualCellManyToMany v-else-if="isMm(column)" />
    <LazyVirtualCellBelongsTo v-else-if="isBt(column)" />
    <LazyVirtualCellOneToOne v-else-if="isOo(column)" />
    <LazyVirtualCellRollup v-else-if="isRollup(column)" />
    <LazyVirtualCellFormula v-else-if="isFormula(column)" />
    <LazyVirtualCellQrCode v-else-if="isQrCode(column)" />
    <LazyVirtualCellBarcode v-else-if="isBarcode(column)" />
    <LazyVirtualCellCount v-else-if="isCount(column)" />
    <LazyVirtualCellLookup v-else-if="isLookup(column)" />
    <LazyVirtualCellButton v-else-if="isButton(column)" />
    <LazyCellReadOnlyDateTimePicker v-else-if="isCreatedOrLastModifiedTimeCol(column)" :model-value="modelValue" />
    <LazyCellReadOnlyUser v-else-if="isCreatedOrLastModifiedByCol(column)" :model-value="modelValue" />
  </div>
</template>

<style lang="scss" scoped>
.nc-virtual-cell {
  &.nc-display-value-cell {
    @apply !text-brand-500;
  }
}
</style>
