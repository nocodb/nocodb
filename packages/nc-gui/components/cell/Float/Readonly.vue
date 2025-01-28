<script lang="ts" setup>
interface Props {
  // when we set a number, then it is number type
  // for sqlite, when we clear a cell or empty the cell, it returns ""
  // otherwise, it is null type
  modelValue?: number | null | string
}

defineProps<Props>()
</script>

<template>
  <span class="nc-cell-field">{{ modelValue }}</span>
</template>
