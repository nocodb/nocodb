<script setup lang="ts">
import { dateFormats, useVModel } from '#imports'

const props = defineProps<{
  value: any
}>()

const emit = defineEmits(['update:value'])

const vModel = useVModel(props, 'value', emit)

if (!vModel.value.meta?.date_format) {
  if (!vModel.value.meta) vModel.value.meta = {}
  vModel.value.meta.date_format = dateFormats[0]
}
</script>

<template>
  <a-form-item :label="$t('labels.dateFormat')">
    <a-select v-model:value="vModel.meta.date_format" dropdown-class-name="nc-dropdown-date-format">
      <a-select-option v-for="(format, i) of dateFormats" :key="i" :value="format">
        <div class="flex flex-row items-center">
          <div class="text-xs">
            {{ format }}
          </div>
        </div>
      </a-select-option>
    </a-select>
  </a-form-item>
</template>
