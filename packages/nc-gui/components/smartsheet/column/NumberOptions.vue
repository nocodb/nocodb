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
  { value: SeparatorType.Locale, label: t('labels.separatorLocal'), preview: '1,000,000' },
  { value: SeparatorType.NonePeriod, label: t('labels.separatorNonePeriod'), preview: '1000000' },
  { value: SeparatorType.CommaPeriod, label: t('labels.separatorCommaPeriod'), preview: '1,000,000' },
  { value: SeparatorType.PeriodComma, label: t('labels.separatorPeriodComma'), preview: '1.000.000' },
  { value: SeparatorType.SpacePeriod, label: t('labels.separatorSpacePeriod'), preview: '1 000 000' },
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
      option-label-prop="label"
      dropdown-class-name="nc-dropdown-number-separator-format"
    >
      <template #suffixIcon>
        <GeneralIcon icon="arrowDown" class="text-nc-content-gray-subtle" />
      </template>
      <a-select-option
        v-for="option of separatorOptions"
        :key="option.value"
        :value="option.value"
        :label="option.label ? `${option.label} (${option.preview})` : option.preview"
      >
        <div class="flex w-full justify-between items-center">
          <span>{{ option.label }}</span>
          <span class="text-nc-content-gray-muted">{{ option.preview }}</span>
        </div>
      </a-select-option>
    </a-select>
  </a-form-item>
</template>
