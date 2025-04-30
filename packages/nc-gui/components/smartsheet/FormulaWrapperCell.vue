<script setup lang="ts">
import { defaultOffscreen2DContext } from './grid/canvas/utils/canvas'

interface Props {
  column?: any
}

const props = defineProps<Props>()

const { column } = toRefs(props)

const cellValue = inject(CellValueInj)

const isGrid = inject(IsGridInj, ref(false))

const isExpandedFormOpen = inject(IsExpandedFormOpenInj, ref(false))

const wapperRef = ref<HTMLDivElement>()

const currentCellRef = inject(CurrentCellInj, ref())

const { width } = useElementSize(wapperRef)

const { showNull } = useGlobal()

const isNumericField = computed(() => {
  return isNumericFieldType(column.value, null)
})

const showAsLongText = computed(() => {
  if (!width.value || !isTextArea(column.value)) return false

  defaultOffscreen2DContext.font = '500 13px Manrope'

  return (
    isTextArea(column.value) &&
    (currentCellRef.value?.getBoundingClientRect()?.width || width.value) - 24 <=
      defaultOffscreen2DContext.measureText(cellValue.value ?? '').width
  )
})

provide(ReadonlyInj, ref(true))
provide(EditModeInj, ref(false))

provide(ColumnInj, column)
</script>

<template>
  <div
    ref="wapperRef"
    class="nc-cell-formula-wrapper nc-cell w-full relative nc-cell-field"
    :class="{
      'nc-grid-numeric-cell-right': isGrid && isNumericField && !isExpandedFormOpen && !isRating(column),
    }"
  >
    <template v-if="showNull && (ncIsNull(cellValue) || ncIsUndefined(cellValue))">
      <LazyCellText model-value="NULL" />
    </template>
    <LazyCellCheckbox v-else-if="isBoolean(column)" :model-value="cellValue" />
    <LazyCellCurrency v-else-if="isCurrency(column)" :model-value="cellValue" />
    <LazyCellDecimal v-else-if="isDecimal(column)" :model-value="cellValue" />
    <div v-else-if="isPercent(column)" class="flex" :class="{ 'h-[30px] min-h-[30px]': parseProp(column.meta)?.is_progress }">
      <LazyCellPercentReadonly :model-value="cellValue" />
    </div>
    <LazyCellRating v-else-if="isRating(column)" :model-value="cellValue" />
    <LazyCellDateReadonly v-else-if="isDate(column, '')" :model-value="cellValue" />
    <LazyCellDateTimeReadonly v-else-if="isDateTime(column, '')" :model-value="cellValue" />
    <LazyCellTime v-else-if="isTime(column, '')" :model-value="cellValue" />
    <LazyCellEmail v-else-if="isEmail(column)" :model-value="cellValue" />
    <LazyCellUrl v-else-if="isURL(column)" :model-value="cellValue" />
    <LazyCellPhoneNumber v-else-if="isPhoneNumber(column)" :model-value="cellValue" />
    <LazyCellTextArea v-else-if="isTextArea(column) && showAsLongText" :model-value="cellValue" />
    <LazyCellText v-else :model-value="cellValue" />
  </div>
</template>

<style scoped lang="scss">
.nc-grid-numeric-cell-left {
  text-align: left;
  :deep(input) {
    text-align: left;
  }
}
.nc-grid-numeric-cell-right {
  text-align: right;
  :deep(input) {
    text-align: right;
  }
}

.nc-cell {
  @apply text-sm;
  font-weight: 500;

  :deep(.nc-cell-field) {
    @apply !text-sm;
    font-weight: 500;
  }

  &.nc-display-value-cell {
    @apply !text-brand-500 !font-semibold;

    :deep(.nc-cell-field) {
      @apply !font-semibold;
    }
  }

  :deep(.nc-cell-field) {
    @apply px-0;
  }
}

.nc-cell-formula-wrapper {
  &:has(.long-text-wrapper) {
    @apply !px-0;
  }
}
</style>
