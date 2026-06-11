<script setup lang="ts">
interface Props {
  modelValue?: string | null
}

const props = defineProps<Props>()

const { showNull } = useGlobal()

const rowHeight = inject(RowHeightInj, ref(undefined))

const vModel = useVModel(props, 'modelValue')
</script>

<template>
  <span v-if="vModel === null && showNull" class="nc-cell-field nc-null uppercase">{{ $t('general.null') }}</span>

  <LazyCellClampedText
    v-else
    class="nc-cell-field nc-uuid-cell"
    :value="vModel"
    :lines="rowHeight"
    :style="{ 'word-break': 'break-word', 'font-family': 'monospace' }"
  />
</template>

<style scoped>
.nc-uuid-cell {
  font-family: monospace;
}
</style>
