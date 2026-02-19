<script lang="ts" setup>
interface Props {
  modelValue?: string | null
}

defineProps<Props>()

// UUID is read-only, so the editor is the same as readonly
const rowHeight = inject(RowHeightInj, ref(undefined))
</script>

<template>
  <div class="nc-cell-field uuid-cell">
    <LazyCellClampedText
      class="clamped-text font-mono"
      :value="modelValue"
      :lines="rowHeight"
      :style="{ 'word-break': 'break-all', 'font-family': 'monospace', 'font-size': '0.9em' }"
    />
  </div>
</template>

<style scoped>
.uuid-cell {
  font-family: monospace;
  font-size: 0.9em;
  color: #666;
}
</style>