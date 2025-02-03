<script setup lang="ts">
interface Props {
  modelValue: any
  column?: any
}

const props = defineProps<Props>()

const column = toRef(props, 'column')

const isGrid = inject(IsGridInj, ref(false))

const isExpandedFormOpen = inject(IsExpandedFormOpenInj, ref(false))

const isNumericField = computed(() => {
  return isNumericFieldType(column.value, null)
})

provide(ReadonlyInj, ref(true))
provide(EditModeInj, ref(false))

provide(ColumnInj, column)
</script>

<template>
  <div
    class="nc-cell w-full h-full relative nc-cell-field"
    :class="{
      'nc-grid-numeric-cell-right': isGrid && isNumericField && !isExpandedFormOpen && !isRating(column),
    }"
  >
    <LazyCellCheckbox v-if="isBoolean(column)" :model-value="modelValue" />
    <LazyCellCurrency v-else-if="isCurrency(column)" :model-value="modelValue" />
    <LazyCellDecimal v-else-if="isDecimal(column)" :model-value="modelValue" />
    <LazyCellPercent v-else-if="isPercent(column)" :model-value="modelValue" />
    <LazyCellRating v-else-if="isRating(column)" :model-value="modelValue" />
    <LazyCellDateReadonly v-else-if="isDate(column, '')" :model-value="modelValue" />
    <LazyCellDateTimeReadonly v-else-if="isDateTime(column, '')" :model-value="modelValue" />
    <LazyCellTime v-else-if="isTime(column, '')" :model-value="modelValue" />
    <LazyCellEmail v-else-if="isEmail(column)" :model-value="modelValue" />
    <LazyCellUrl v-else-if="isURL(column)" :model-value="modelValue" />
    <LazyCellPhoneNumber v-else-if="isPhoneNumber(column)" :model-value="modelValue" />
    <LazyCellText v-else :model-value="modelValue" />
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
</style>
