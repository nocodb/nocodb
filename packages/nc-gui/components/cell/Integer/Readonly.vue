<script setup lang="ts">
import {
  SeparatorType,
  abbreviateNumber,
  formatNumberWithSeparator,
  getSeparatorChars,
  resolveColumnSeparator,
  shouldAbbreviateNumber,
} from 'nocodb-sdk'

interface Props {
  // when we set a number, then it is number type
  // for sqlite, when we clear a cell or empty the cell, it returns ""
  // otherwise, it is null type
  modelValue?: number | null | string
}

const props = defineProps<Props>()

const column = inject(ColumnInj, null)!

const displayValue = computed(() => {
  if (props.modelValue === null) return null

  if (isNaN(Number(props.modelValue))) return null

  const colMeta = parseProp(column.value.meta)

  if (shouldAbbreviateNumber(colMeta)) {
    return abbreviateNumber(Number(props.modelValue), colMeta)
  }

  const separator = resolveColumnSeparator(colMeta)

  if (separator === SeparatorType.Locale) {
    return Number(props.modelValue).toLocaleString()
  }

  const { thousandSeparator } = getSeparatorChars(separator)

  if (!thousandSeparator) {
    return Number(props.modelValue)
  }

  return formatNumberWithSeparator(Number(props.modelValue), thousandSeparator, '.')
})
</script>

<template>
  <div class="nc-cell-field truncate">{{ displayValue }}</div>
</template>
