<script setup lang="ts">
import dayjs from 'dayjs'

interface Props {
  modelValue?: number | string | null
}

const { modelValue } = defineProps<Props>()

const localState = computed(() => {
  if (!modelValue) {
    return undefined
  }

  const yearDate = dayjs(modelValue.toString(), 'YYYY')
  if (!yearDate.isValid()) {
    return undefined
  }

  return yearDate
})
</script>

<template>
  <div class="nc-cell-field tracking-tight truncate">
    {{ localState?.format('YYYY') ?? '' }}
  </div>
</template>
