<script setup lang="ts">
interface Props {
  modelValue?: string | null
}

const props = defineProps<Props>()

const { showNull } = useGlobal()

const readOnly = inject(ReadonlyInj, ref(false))

const rowHeight = inject(RowHeightInj, ref(undefined))
</script>

<template>
  <span v-if="props.modelValue === null && showNull" class="nc-cell-field nc-null uppercase">{{ $t('general.null') }}</span>

  <div v-else class="nc-cell-field uuid-cell">
    <LazyCellClampedText
      class="clamped-text font-mono"
      :value="props.modelValue"
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
  cursor: default;
}
</style>