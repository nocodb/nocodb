<script setup lang="ts">
import { dateFormats, timeFormats } from 'nocodb-sdk'

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
  <div class="flex flex-col gap-2">
    <div class="flex items-center gap-2 children:flex-1">
      <a-form-item>
        <a-select v-model:value="vModel.meta.date_format" class="nc-date-select" dropdown-class-name="nc-dropdown-date-format">
          <template #suffixIcon>
            <GeneralIcon icon="arrowDown" class="text-gray-700" />
          </template>

          <a-select-option v-for="(format, i) of dateFormats" :key="i" :value="format">
            <div class="flex gap-2 w-full justify-between items-center">
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
      <a-form-item>
        <a-select v-model:value="vModel.meta.time_format" class="nc-time-select" dropdown-class-name="nc-dropdown-time-format">
          <template #suffixIcon>
            <GeneralIcon icon="arrowDown" class="text-gray-700" />
          </template>

          <a-select-option v-for="(format, i) of timeFormats" :key="i" :value="format">
            <div class="flex gap-2 w-full justify-between items-center" :data-testid="`nc-time-${format}`">
              {{ format }}
              <component
                :is="iconMap.check"
                v-if="vModel.meta.time_format === format"
                id="nc-selected-item-icon"
                class="text-primary w-4 h-4"
              />
            </div>
          </a-select-option>
        </a-select>
      </a-form-item>
    </div>
  </div>
</template>
