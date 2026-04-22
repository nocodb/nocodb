<script setup lang="ts">
import { ColumnHelper, SeparatorType, UITypes } from 'nocodb-sdk'

const props = defineProps<{
  value: any
}>()

const emit = defineEmits(['update:value'])

const { t } = useI18n()

const vModel = useVModel(props, 'value', emit)

// set default value
vModel.value.meta = {
  ...ColumnHelper.getColumnDefaultMeta(UITypes.Number),
  ...(vModel.value.meta || {}),
}

const { isSystem } = useColumnCreateStoreOrThrow()

const separatorOptions = [
  { value: SeparatorType.Locale, label: t('labels.separatorFollowLocale') },
  { value: SeparatorType.NonePeriod, label: '1234' },
  { value: SeparatorType.CommaPeriod, label: '1,234' },
  { value: SeparatorType.PeriodComma, label: '1.234' },
  { value: SeparatorType.SpacePeriod, label: '1 234' },
]

// Backward compat: resolve isLocaleString to separator if separator is not yet set
if (!vModel.value.meta.separator) {
  vModel.value.meta.separator = vModel.value.meta.isLocaleString
    ? SeparatorType.CommaPeriod
    : SeparatorType.NonePeriod
}
</script>

<template>
  <a-form-item :label="$t('labels.separator')">
    <a-select
      v-model:value="vModel.meta.separator"
      :disabled="isSystem"
      dropdown-class-name="nc-dropdown-number-separator-format"
    >
      <template #suffixIcon>
        <GeneralIcon icon="arrowDown" class="text-nc-content-gray-subtle" />
      </template>
      <a-select-option v-for="option of separatorOptions" :key="option.value" :value="option.value">
        <div class="flex gap-2 w-full justify-between items-center">
          {{ option.label }}
          <component
            :is="iconMap.check"
            v-if="vModel.meta.separator === option.value"
            id="nc-selected-item-icon"
            class="text-nc-content-brand w-4 h-4"
          />
        </div>
      </a-select-option>
    </a-select>
  </a-form-item>
</template>
