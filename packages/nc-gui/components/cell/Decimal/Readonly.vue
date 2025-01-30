<script lang="ts" setup>
import { roundUpToPrecision } from 'nocodb-sdk'

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

  if (meta.value.isLocaleString) {
    return Number(roundUpToPrecision(Number(props.modelValue), meta.value.precision ?? 1)).toLocaleString(undefined, {
      minimumFractionDigits: meta.value.precision ?? 1,
      maximumFractionDigits: meta.value.precision ?? 1,
    })
  }

  return roundUpToPrecision(Number(props.modelValue), meta.value.precision ?? 1)
})
</script>

<template>
  <div class="nc-cell-field truncate">{{ displayValue }}</div>
</template>
