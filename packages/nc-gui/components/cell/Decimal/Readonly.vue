<script lang="ts" setup>
import {
  SeparatorType,
  formatNumberWithSeparator,
  getSeparatorChars,
  resolveColumnSeparator,
  roundUpToPrecision,
} from 'nocodb-sdk'

interface Props {
  // when we set a number, then it is number type
  // for sqlite, when we clear a cell or empty the cell, it returns ""
  // otherwise, it is null type
  modelValue?: number | null | string
}

const props = defineProps<Props>()

const column = inject(ColumnInj, null)!

const meta = computed(() => {
  return typeof column?.value.meta === 'string' ? JSON.parse(column.value.meta) : column?.value.meta ?? {}
})

const displayValue = computed(() => {
  if (props.modelValue === null) return null

  if (isNaN(Number(props.modelValue))) return null

  const separator = resolveColumnSeparator(meta.value)
  const precision = meta.value.precision ?? 1
  const numValue = Number(roundUpToPrecision(Number(props.modelValue), precision))

  if (separator === SeparatorType.Locale) {
    return numValue.toLocaleString(undefined, {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
    })
  }

  const { thousandSeparator, decimalSeparator } = getSeparatorChars(separator)
  return formatNumberWithSeparator(numValue, thousandSeparator, decimalSeparator, precision)
})
</script>

<template>
  <div class="nc-cell-field truncate">{{ displayValue }}</div>
</template>
