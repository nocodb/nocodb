<script setup lang="ts">
import dayjs from 'dayjs'

interface Props {
  modelValue?: string | null
}

const { modelValue } = defineProps<Props>()

const columnMeta = inject(ColumnInj, null)!

const dateFormat = computed(() => parseProp(columnMeta?.value?.meta)?.date_format ?? 'YYYY-MM-DD')

const localState = computed(() => {
  if (!modelValue) {
    return undefined
  }

  if (!dayjs(modelValue).isValid()) {
    return undefined
  }

  return dayjs(/^\d+$/.test(modelValue) ? +modelValue : modelValue, dateFormat.value)
})
</script>

<template>
  <div class="nc-cell-field tracking-tight truncate">
    {{ localState?.format(dateFormat) ?? '' }}
  </div>
</template>
