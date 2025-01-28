<script setup lang="ts">
import dayjs from 'dayjs'
import { isDateMonthFormat } from 'nocodb-sdk'

interface Props {
  modelValue?: string | null
}

const { modelValue } = defineProps<Props>()

const columnMeta = inject(ColumnInj, null)!

const dateFormat = computed(() => parseProp(columnMeta?.value?.meta)?.date_format ?? 'YYYY-MM-DD')

const picker = computed(() => (isDateMonthFormat(dateFormat.value) ? 'month' : ''))

const localState = computed(() => {
  if (!modelValue) {
    return undefined
  }

  if (!dayjs(modelValue).isValid()) {
    return undefined
  }

  const format = picker.value === 'month' ? dateFormat : 'YYYY-MM-DD'

  return dayjs(/^\d+$/.test(modelValue) ? +modelValue : modelValue, format)
})
</script>

<template>
  <div :title="localState?.format(dateFormat)" class="nc-date-picker nc-cell-field tracking-tight truncate">
    {{ localState?.format(dateFormat) ?? '' }}
  </div>
</template>
