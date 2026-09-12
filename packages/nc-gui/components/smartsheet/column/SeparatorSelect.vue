<script setup lang="ts">
import { SeparatorType } from 'nocodb-sdk'

interface Props {
  value: SeparatorType
  disabled?: boolean
  integer?: boolean
  dropdownClassName?: string
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  integer: false,
  dropdownClassName: 'nc-dropdown-separator-format',
})

const emit = defineEmits(['update:value'])

const { t } = useI18n()

const vModel = useVModel(props, 'value', emit)

const separatorOptions = computed(() => {
  const decimalSuffix = props.integer ? '' : '.00'
  const altDecimalSuffix = props.integer ? '' : ',00'

  const all = [
    { value: SeparatorType.Locale, label: t('labels.separatorLocale'), preview: `1,000,000${decimalSuffix}` },
    { value: SeparatorType.NonePeriod, label: t('labels.separatorNonePeriod'), preview: `1000000${decimalSuffix}` },
    { value: SeparatorType.NoneComma, label: t('labels.separatorNoneComma'), preview: `1000000${altDecimalSuffix}` },
    { value: SeparatorType.CommaPeriod, label: t('labels.separatorCommaPeriod'), preview: `1,000,000${decimalSuffix}` },
    { value: SeparatorType.PeriodComma, label: t('labels.separatorPeriodComma'), preview: `1.000.000${altDecimalSuffix}` },
    { value: SeparatorType.SpacePeriod, label: t('labels.separatorSpacePeriod'), preview: `1 000 000${decimalSuffix}` },
    { value: SeparatorType.SpaceComma, label: t('labels.separatorSpaceComma'), preview: `1 000 000${altDecimalSuffix}` },
  ]

  // Integer columns have no fractional part, so *Comma options would render
  // identically to their *Period counterparts — drop them to avoid duplicates.
  if (props.integer) {
    return all.filter((option) => option.value !== SeparatorType.NoneComma && option.value !== SeparatorType.SpaceComma)
  }

  return all
})
</script>

<template>
  <a-form-item :label="$t('labels.separator')">
    <a-select v-model:value="vModel" :disabled="disabled" option-label-prop="label" :dropdown-class-name="dropdownClassName">
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
