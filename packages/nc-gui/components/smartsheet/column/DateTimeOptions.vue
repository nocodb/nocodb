<script setup lang="ts">
import { dateFormats, timeFormats, useVModel } from '#imports'

const props = defineProps<{
  value: any
}>()

const emit = defineEmits(['update:value'])

const vModel = useVModel(props, 'value', emit)

if (!vModel.value.meta?.date_format) {
  if (!vModel.value.meta) vModel.value.meta = {}
  vModel.value.meta.date_format = dateFormats[0]
}

if (!vModel.value.meta?.time_format) {
  if (!vModel.value.meta) vModel.value.meta = {}
  vModel.value.meta.time_format = timeFormats[0]
}
</script>

<template>
  <a-form-item :label="$t('labels.dateFormat')">
    <a-select v-model:value="vModel.meta.date_format" class="nc-date-select" dropdown-class-name="nc-dropdown-date-format">
      <a-select-option v-for="(format, i) of dateFormats" :key="i" :value="format">
        {{ format }}
      </a-select-option>
    </a-select>
  </a-form-item>
  <a-form-item :label="$t('labels.timeFormat')">
    <a-select v-model:value="vModel.meta.time_format" class="nc-time-select" dropdown-class-name="nc-dropdown-time-format">
      <a-select-option v-for="(format, i) of timeFormats" :key="i" :value="format">
        {{ format }}
      </a-select-option>
    </a-select>
  </a-form-item>
</template>
