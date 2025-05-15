<script setup lang="ts">
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

  if (parseProp(column.value.meta).isLocaleString) return Number(props.modelValue).toLocaleString()

  return Number(props.modelValue)
})
</script>

<template>
  <div class="nc-cell-field truncate">{{ displayValue }}</div>
</template>
