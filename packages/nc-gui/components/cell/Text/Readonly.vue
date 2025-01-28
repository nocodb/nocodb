<script lang="ts" setup>
interface Props {
  modelValue?: string | number | null
}

defineProps<Props>()

const rowHeight = inject(RowHeightInj, ref(undefined))

const { showNull } = useGlobal()
</script>

<template>
  <span v-if="modelValue === null && showNull" class="nc-cell-field nc-null uppercase">{{ $t('general.null') }}</span>
  <LazyCellClampedText
    v-else
    class="nc-cell-field"
    :value="modelValue"
    :lines="rowHeight"
    :style="{ 'word-break': 'break-word' }"
  />
</template>
