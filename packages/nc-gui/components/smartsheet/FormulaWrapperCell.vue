<script setup lang="ts">
import { FormulaDataTypes, UITypes, isFormulaNonFiniteValue } from 'nocodb-sdk'
import { type LocalSelectOptionType, getOptions } from '../cell/SingleSelect/utils'
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

// Only a numeric formula can carry a pg IEEE value; a string formula returning
// the literal "Infinity" is an ordinary result and must not get the error style.
const isNonFiniteResult = computed(
  () =>
    (column.value.colOptions as any)?.parsed_tree?.dataType === FormulaDataTypes.NUMERIC &&
    isFormulaNonFiniteValue(cellValue?.value),
)

const showAsLongText = computed(() => {
  if (!width.value || !isTextArea(column.value)) return false

  defaultOffscreen2DContext.font = '500 13px Inter'

  return (
    isTextArea(column.value) &&
    (currentCellRef.value?.getBoundingClientRect()?.width || width.value) - 24 <=
      defaultOffscreen2DContext.measureText(cellValue.value ?? '').width
  )
})

const { isDark, getColor } = useTheme()

// Single select display format (a formula referencing a select field carries no options here)
const isSelectDisplay = computed(() => isSingleSelect(column.value) && ncIsArray(column.value.colOptions?.options))

const selectDisplayValue = computed(() => {
  if (!isSelectDisplay.value) return undefined
  const value = getFormulaSelectDisplayValue(cellValue?.value, column.value)
  return ncIsNullOrUndefined(value) ? undefined : String(value)
})

const selectDisplayOptions = computed<LocalSelectOptionType[]>(() => {
  if (!isSelectDisplay.value) return []

  const options = getOptions(column.value, false, false, isDark.value, getColor)
  const text = selectDisplayValue.value?.trim()

  if (!text || options.some((op) => op.value === text)) return options

  // A result matching no option shows as a gray chip
  return [
    ...options,
    {
      title: text,
      value: text,
      bgColor: getSelectTypeFieldOptionBgColor({ color: '#e7e7e9', isDark: isDark.value, getColor }),
      textColor: getSelectTypeFieldOptionTextColor({ color: '#e7e7e9', isDark: isDark.value, getColor }),
    },
  ]
})

const referencedColumnUidt = computed(() => {
  return column.value.colOptions?.parsed_tree?.referencedColumn?.uidt
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
    <template v-if="isNonFiniteResult">
      <span class="nc-formula-non-finite text-nc-content-orange-dark">{{ cellValue }}</span>
    </template>
    <template v-else-if="showNull && (ncIsNull(cellValue) || ncIsUndefined(cellValue))">
      <CellText model-value="NULL" />
    </template>
    <CellCheckbox v-else-if="isBoolean(column)" :model-value="cellValue" />
    <CellCurrency v-else-if="isCurrency(column)" :model-value="cellValue" />
    <CellDecimal v-else-if="isDecimal(column)" :model-value="cellValue" />
    <div v-else-if="isPercent(column)" class="flex" :class="{ 'h-[30px] min-h-[30px]': parseProp(column.meta)?.is_progress }">
      <CellPercentReadonly :model-value="cellValue" />
    </div>
    <CellRating v-else-if="isRating(column)" :model-value="cellValue" />
    <CellDateReadonly v-else-if="isDate(column, '')" :model-value="cellValue" />
    <CellDateTimeReadonly v-else-if="isDateTime(column, '')" :model-value="cellValue" />
    <CellTime v-else-if="isTime(column, '')" :model-value="cellValue" />
    <!-- the wrapper already pads the cell -->
    <CellSingleSelectReadonly
      v-else-if="isSelectDisplay"
      class="!px-0"
      :model-value="selectDisplayValue"
      :options="selectDisplayOptions"
    />
    <CellEmail v-else-if="isEmail(column)" :model-value="cellValue" />
    <CellUrl v-else-if="isURL(column)" :model-value="cellValue" />
    <CellPhoneNumber v-else-if="isPhoneNumber(column)" :model-value="cellValue" />
    <LazyCellTextArea v-else-if="isTextArea(column) && showAsLongText" :model-value="cellValue" />
    <LazyCellAttachment v-else-if="[UITypes.Attachment].includes(referencedColumnUidt)" :model-value="cellValue" />
    <LazyCellUserReadonly v-else-if="[UITypes.User].includes(referencedColumnUidt)" :model-value="cellValue" />
    <CellText v-else :model-value="cellValue" />
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
    @apply !text-nc-content-brand !font-semibold;

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
