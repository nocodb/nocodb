<script setup lang="ts">
import { dateFormats, dateMonthFormats } from 'nocodb-sdk'
import { useVModel } from '#imports'

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
    <a-select
      v-model:value="vModel.meta.date_format"
      show-search
      class="nc-date-select"
      dropdown-class-name="nc-dropdown-date-format"
    >
      <a-select-option v-for="(format, i) of [...dateFormats, ...dateMonthFormats]" :key="i" :value="format">
        <div class="flex gap-2 justify-between items-center">
          {{ format }}
          <component
            :is="iconMap.check"
            v-if="vModel.meta.date_format === format"
            id="nc-selected-item-icon"
            class="text-primary w-4 h-4"
          />
        </div>
      </a-select-option>
    </a-select>
  </a-form-item>
</template>
