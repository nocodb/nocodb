<script lang="ts" setup>
interface Props {
  modelValue?: string | null
}

defineProps<Props>()

const rowHeight = inject(RowHeightInj, ref(undefined))
</script>

<template>
  <LazyCellClampedText
    class="nc-cell-field nc-uuid-cell"
    :value="modelValue"
    :lines="rowHeight"
    :style="{ 'word-break': 'break-word', 'font-family': 'monospace' }"
  />
</template>

<style scoped>
.nc-uuid-cell {
  font-family: monospace;
}
</style>
