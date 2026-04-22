<script setup lang="ts">
import { ColumnHelper, SeparatorType, UITypes, readonlyMetaAllowedTypes } from 'nocodb-sdk'

const props = defineProps<{
  value: any
}>()

const emit = defineEmits(['update:value'])

const { t } = useI18n()

const vModel = useVModel(props, 'value', emit)

const precisionFormatsDisplay = makePrecisionFormatsDiplay(t)

// set default value
vModel.value.meta = {
  ...ColumnHelper.getColumnDefaultMeta(UITypes.Decimal),
  ...(vModel.value.meta || {}),
}

// update datatype precision when precision is less than the new value
// avoid downgrading precision if the new value is less than the current precision
// to avoid fractional part data loss(eg. 1.2345 -> 1.23)
const onPrecisionChange = (value: number) => {
  vModel.value.dtxs = Math.max(value, vModel.value.dtxs)
}

const { isMetaReadOnly } = useRoles()

const { formState } = useColumnCreateStoreOrThrow()

const disableConfiguration = computed(
  () => Boolean(isMetaReadOnly.value) && !readonlyMetaAllowedTypes.includes(formState.value.uidt),
)

const separatorOptions = [
  { value: SeparatorType.Locale, label: t('labels.separatorFollowLocale') },
  { value: SeparatorType.NonePeriod, label: '1234.56' },
  { value: SeparatorType.NoneComma, label: '1234,56' },
  { value: SeparatorType.CommaPeriod, label: '1,234.56' },
  { value: SeparatorType.PeriodComma, label: '1.234,56' },
  { value: SeparatorType.SpacePeriod, label: '1 234.56' },
  { value: SeparatorType.SpaceComma, label: '1 234,56' },
]

// Backward compat: resolve isLocaleString to separator if separator is not yet set
if (!vModel.value.meta.separator) {
  vModel.value.meta.separator = vModel.value.meta.isLocaleString
    ? SeparatorType.CommaPeriod
    : SeparatorType.NonePeriod
}
</script>

<template>
  <a-form-item :label="$t('placeholder.precision')">
    <a-select
      v-if="vModel.meta?.precision || vModel.meta?.precision === 0"
      v-model:value="vModel.meta.precision"
      :disabled="disableConfiguration"
      dropdown-class-name="nc-dropdown-decimal-precision-format"
      @change="onPrecisionChange"
    >
      <template #suffixIcon>
        <GeneralIcon icon="arrowDown" class="text-nc-content-gray-subtle" />
      </template>
      <a-select-option v-for="(format, i) of precisionFormats" :key="i" :value="format">
        <div class="flex gap-2 w-full justify-between items-center">
          {{ (precisionFormatsDisplay as any)[format] }}
          <component
            :is="iconMap.check"
            v-if="vModel.meta.precision === format"
            id="nc-selected-item-icon"
            class="text-nc-content-brand w-4 h-4"
          />
        </div>
      </a-select-option>
    </a-select>
  </a-form-item>

  <a-form-item :label="$t('labels.separator')">
    <a-select
      v-model:value="vModel.meta.separator"
      :disabled="disableConfiguration"
      dropdown-class-name="nc-dropdown-decimal-separator-format"
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
