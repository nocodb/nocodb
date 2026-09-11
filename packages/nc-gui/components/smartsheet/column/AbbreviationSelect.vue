<script setup lang="ts">
import { NumberAbbreviationType, resolveNumberAbbreviation } from 'nocodb-sdk'

interface Props {
  value?: NumberAbbreviationType | boolean
  disabled?: boolean
  dropdownClassName?: string
}

const props = withDefaults(defineProps<Props>(), {
  value: NumberAbbreviationType.None,
  disabled: false,
  dropdownClassName: 'nc-dropdown-abbreviation-format',
})

const emit = defineEmits(['update:value'])

const { t } = useI18n()

// legacy metas stored `abbreviate` as a boolean — normalize for display
const vModel = computed<NumberAbbreviationType>({
  get: () => resolveNumberAbbreviation({ abbreviate: props.value }),
  set: (value) => emit('update:value', value),
})

const abbreviationOptions = computed(() => [
  { value: NumberAbbreviationType.None, label: t('general.none'), suffix: '' },
  { value: NumberAbbreviationType.Auto, label: t('labels.abbreviationAuto'), suffix: 'K, M, B, T' },
  { value: NumberAbbreviationType.Thousand, label: t('labels.abbreviationThousand'), suffix: 'K' },
  { value: NumberAbbreviationType.Million, label: t('labels.abbreviationMillion'), suffix: 'M' },
  { value: NumberAbbreviationType.Billion, label: t('labels.abbreviationBillion'), suffix: 'B' },
  { value: NumberAbbreviationType.Trillion, label: t('labels.abbreviationTrillion'), suffix: 'T' },
])
</script>

<template>
  <a-form-item :label="$t('labels.largeNumberAbbreviation')">
    <a-select
      v-model:value="vModel"
      v-e="['c:column:abbreviation:change']"
      :disabled="disabled"
      option-label-prop="label"
      :dropdown-class-name="dropdownClassName"
      data-testid="nc-abbreviation-select"
    >
      <template #suffixIcon>
        <GeneralIcon icon="arrowDown" class="text-nc-content-gray-subtle" />
      </template>
      <a-select-option v-for="option of abbreviationOptions" :key="option.value" :value="option.value" :label="option.label">
        <div class="flex w-full justify-between items-center">
          <span>{{ option.label }}</span>
          <span class="text-nc-content-gray-muted">{{ option.suffix }}</span>
        </div>
      </a-select-option>
    </a-select>
  </a-form-item>
</template>
