<script setup lang="ts">
import { ColumnHelper, UITypes } from 'nocodb-sdk'

const props = defineProps<{
  value: any
}>()

const emit = defineEmits(['update:value'])

const vModel = useVModel(props, 'value', emit)

// Set default meta values from column helper
vModel.value.meta = {
  ...ColumnHelper.getColumnDefaultMeta(UITypes.Colour),
  ...(vModel.value.meta || {}),
}

const displayFormatOptions = [
  { value: 'swatch_hex', label: 'Swatch & Hex' },
  { value: 'swatch_only', label: 'Swatch only' },
  { value: 'hex_only', label: 'Hex only' },
]

const swatchStyleOptions = [
  { value: 'circle', label: 'Circle' },
  { value: 'square', label: 'Square' },
]
</script>

<template>
  <div class="flex flex-col gap-4">
    <a-form-item :label="$t('labels.displayFormat')">
      <a-select v-model:value="vModel.meta.displayFormat" class="w-full" dropdown-class-name="nc-dropdown-colour-display-format">
        <template #suffixIcon>
          <GeneralIcon icon="arrowDown" class="text-nc-content-gray-subtle" />
        </template>

        <a-select-option v-for="option of displayFormatOptions" :key="option.value" :value="option.value">
          <div class="flex gap-2 w-full justify-between items-center">
            {{ option.label }}
            <component
              :is="iconMap.check"
              v-if="vModel.meta.displayFormat === option.value"
              id="nc-selected-item-icon"
              class="text-nc-content-brand w-4 h-4"
            />
          </div>
        </a-select-option>
      </a-select>
    </a-form-item>

    <a-form-item :label="$t('labels.swatchStyle')">
      <a-select v-model:value="vModel.meta.swatchStyle" class="w-full" dropdown-class-name="nc-dropdown-colour-swatch-style">
        <template #suffixIcon>
          <GeneralIcon icon="arrowDown" class="text-nc-content-gray-subtle" />
        </template>

        <a-select-option v-for="option of swatchStyleOptions" :key="option.value" :value="option.value">
          <div class="flex gap-2 w-full justify-between items-center">
            {{ option.label }}
            <component
              :is="iconMap.check"
              v-if="vModel.meta.swatchStyle === option.value"
              id="nc-selected-item-icon"
              class="text-nc-content-brand w-4 h-4"
            />
          </div>
        </a-select-option>
      </a-select>
    </a-form-item>
  </div>
</template>
