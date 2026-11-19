<script setup lang="ts">
import dayjs from 'dayjs'
import { parseStoredDate } from 'nocodb-sdk'
import { parseFlexibleDate } from '~/utils/datetimeUtils'

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
    const parsedDate = parseFlexibleDate(modelValue)
    if (parsedDate) {
      return parsedDate
    }
    return undefined
  }

  return parseStoredDate(modelValue)
})
</script>

<template>
  <div :title="localState?.format(dateFormat)" class="nc-date-picker nc-cell-field tracking-tight truncate">
    {{ localState?.format(dateFormat) ?? '' }}
  </div>
</template>
