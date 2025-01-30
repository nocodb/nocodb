<script lang="ts" setup>
interface Props {
  modelValue?: string | number | null
}

defineProps<Props>()

const rowHeight = inject(RowHeightInj, ref(undefined))
</script>

<template>
  <LazyCellClampedText
    class="nc-cell-field clamped-text"
    :value="modelValue"
    :lines="rowHeight"
    :style="{ 'word-break': 'break-word' }"
  />
</template>
