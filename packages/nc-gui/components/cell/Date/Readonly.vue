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
  <span class="nc-cell-field">
    {{ localState?.format(dateFormat) ?? '' }}
  </span>
</template>

<style scoped lang="scss"></style>
