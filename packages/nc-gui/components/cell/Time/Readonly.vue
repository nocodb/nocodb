<script setup lang="ts">
import dayjs from 'dayjs'

interface Props {
  modelValue?: string | null | undefined
}

const { modelValue } = defineProps<Props>()

const column = inject(ColumnInj)!

const localState = computed(() => {
  if (!modelValue) {
    return undefined
  }
  let dateTime = dayjs(modelValue)

  if (!dateTime.isValid()) {
    dateTime = dayjs(modelValue, 'HH:mm:ss')
  }
  if (!dateTime.isValid()) {
    dateTime = dayjs(`1999-01-01 ${modelValue}`)
  }
  if (!dateTime.isValid()) {
    return undefined
  }

  return dateTime
})

const cellValue = computed(() => localState.value?.format(parseProp(column.value.meta).is12hrFormat ? 'hh:mm A' : 'HH:mm') ?? '')
</script>

<template>
  <div :title="localState?.format('HH:mm')" class="nc-time-picker nc-cell-field tracking-tight truncate">
    {{ cellValue }}
  </div>
</template>
