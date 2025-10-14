<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'
import { isCreatedOrLastModifiedByCol, isCreatedOrLastModifiedTimeCol } from 'nocodb-sdk'

const props = defineProps<{
  column: ColumnType
  modelValue: any
  row?: Row
  active?: boolean
  path?: Array<number>
  readOnly?: boolean
  isAllowed?: boolean
}>()

const emit = defineEmits(['update:modelValue', 'navigate', 'save'])

const column = toRef(props, 'column')
const active = toRef(props, 'active', false)
const row = toRef(props, 'row')
const path = toRef(props, 'path')
const readOnly = toRef(props, 'readOnly', false)
const isAllowed = toRef(props, 'isAllowed', true)

provide(ColumnInj, column)
provide(ActiveCellInj, active)
provide(RowInj, row)
provide(GroupPathInj, path)
provide(CellValueInj, toRef(props, 'modelValue'))
provide(SaveRowInj, () => emit('save'))
provide(ReadonlyInj, readOnly)
provide(IsAllowedInj, isAllowed)

const isGrid = inject(IsGridInj, ref(false))

const isForm = inject(IsFormInj, ref(false))

const isExpandedForm = inject(IsExpandedFormOpenInj, ref(false))

function onNavigate(dir: NavigateDir, e: KeyboardEvent) {
  emit('navigate', dir)

  if (!isForm.value) e.stopImmediatePropagation()
}

const isPrimaryCol = computed(() => isPrimary(column.value))

const virtualCellType = computed(() => {
  if (isLink(column.value)) return 'link'
  if (isHm(column.value)) return 'hm'
  if (isMm(column.value)) return 'mm'
  if (isBt(column.value)) return 'bt'
  if (isOo(column.value)) return 'oo'
  if (isRollup(column.value)) return 'rollup'
  if (isFormula(column.value)) return 'formula'
  if (isQrCode(column.value)) return 'qrCode'
  if (isBarcode(column.value)) return 'barcode'
  if (isCount(column.value)) return 'count'
  if (isLookup(column.value)) return 'lookup'
  if (isButton(column.value)) return 'button'
  if (isCreatedOrLastModifiedTimeCol(column.value)) return 'createdOrLastModifiedTimeCol'
  if (isCreatedOrLastModifiedByCol(column.value)) return 'createdOrLastModifiedByCol'
})

const virtualCellClassName = computed(() => {
  let className = `nc-virtual-cell-${(column.value.uidt || 'default').toLowerCase()}`

  if (isGrid.value && !isForm.value && virtualCellType.value === 'rollup' && !isExpandedForm.value) {
    className += ' text-right justify-end'
  }
  if (isPrimaryCol.value && !isForm.value) {
    className += ' nc-display-value-cell'
  }

  return className
})
</script>

<template>
  <div
    class="nc-virtual-cell w-full flex items-center"
    :class="virtualCellClassName"
    @keydown.enter.exact="onNavigate(NavigateDir.NEXT, $event)"
    @keydown.shift.enter.exact="onNavigate(NavigateDir.PREV, $event)"
  >
    <VirtualCellLinks v-if="virtualCellType === 'link'" />
    <VirtualCellHasMany v-else-if="virtualCellType === 'hm'" />
    <VirtualCellManyToMany v-else-if="virtualCellType === 'mm'" />
    <VirtualCellBelongsTo v-else-if="virtualCellType === 'bt'" />
    <VirtualCellOneToOne v-else-if="virtualCellType === 'oo'" />
    <VirtualCellRollup v-else-if="virtualCellType === 'rollup'" />
    <VirtualCellFormula v-else-if="virtualCellType === 'formula'" />
    <VirtualCellQrCode v-else-if="virtualCellType === 'qrCode'" />
    <VirtualCellBarcode v-else-if="virtualCellType === 'barcode'" />
    <VirtualCellCount v-else-if="virtualCellType === 'count'" />
    <VirtualCellLookup v-else-if="virtualCellType === 'lookup'" />
    <VirtualCellButton v-else-if="virtualCellType === 'button'" />
    <CellDateTimeReadonly v-else-if="virtualCellType === 'createdOrLastModifiedTimeCol'" :model-value="modelValue" />
    <CellUserReadonly v-else-if="virtualCellType === 'createdOrLastModifiedByCol'" :model-value="modelValue" />
  </div>
</template>

<style lang="scss" scoped>
.nc-virtual-cell {
  &.nc-display-value-cell {
    @apply !text-brand-500;
  }
}
</style>
