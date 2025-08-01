<script setup lang="ts">
import { ColumnHelper, UITypes } from 'nocodb-sdk'

const props = defineProps<{
  value: any
}>()

const emit = defineEmits(['update:value'])

const { t } = useI18n()

const vModel = useVModel(props, 'value', emit)

const precisionFormatsDisplay = makePrecisionFormatsDiplay(t)

const validators = {
  'meta.currency_locale': [
    {
      validator: (_: any, locale: any) => {
        return new Promise<void>((resolve, reject) => {
          if (!validateCurrencyLocale(locale)) {
            return reject(new Error(t('msg.invalidLocale')))
          }
          resolve()
        })
      },
    },
  ],
  'meta.currency_code': [
    {
      validator: (_: any, currencyCode: any) => {
        return new Promise<void>((resolve, reject) => {
          if (!validateCurrencyCode(currencyCode)) {
            return reject(new Error(t('msg.invalidCurrencyCode')))
          }
          resolve()
        })
      },
    },
  ],
}

const { setAdditionalValidations, validateInfos, isPg } = useColumnCreateStoreOrThrow()

setAdditionalValidations({
  ...validators,
})

const currencyList = currencyCodes || []

const currencyLocaleList = ref<{ text: string; value: string }[]>([])

const isMoney = computed(() => vModel.value.dt === 'money')

const message = computed(() => {
  if (isMoney.value && isPg.value) return t('msg.postgresHasItsOwnCurrencySettings')
  return ''
})

function filterOption(input: string, option: { value: string; key: string }) {
  return searchCompare([option.value, option.key], input)
}

// set default value
vModel.value.meta = {
  ...ColumnHelper.getColumnDefaultMeta(UITypes.Currency),
  ...(vModel.value.meta || {}),
}

currencyLocales().then((locales) => {
  currencyLocaleList.value.push(...locales)
})

// update datatype precision when precision is less than the new value
// avoid downgrading precision if the new value is less than the current precision
// to avoid fractional part data loss(eg. 1.2345 -> 1.23)
const onPrecisionChange = (value: number) => {
  vModel.value.dtxs = Math.max(value, vModel.value.dtxs)
}
</script>

<template>
  <a-row :gutter="8">
    <a-col :span="12">
      <a-form-item v-bind="validateInfos['meta.currency_locale']" :label="$t('title.currencyLocale')">
        <a-select
          v-model:value="vModel.meta.currency_locale"
          class="w-52"
          show-search
          :filter-option="filterOption"
          :disabled="isMoney && isPg"
          dropdown-class-name="nc-dropdown-currency-cell-locale"
        >
          <template #suffixIcon> <GeneralIcon icon="arrowDown" class="text-gray-700" /> </template>

          <a-select-option v-for="currencyLocale of currencyLocaleList" :key="currencyLocale.text" :value="currencyLocale.value">
            <div class="flex gap-2 w-full truncate items-center">
              <NcTooltip show-on-truncate-only class="flex-1 truncate">
                <template #title>{{ currencyLocale.text }}</template>
                {{ currencyLocale.text }}
              </NcTooltip>

              <component
                :is="iconMap.check"
                v-if="vModel.meta.currency_locale === currencyLocale.value"
                id="nc-selected-item-icon"
                class="text-primary w-4 h-4"
              />
            </div>
          </a-select-option>
        </a-select>
      </a-form-item>
    </a-col>

    <a-col :span="12">
      <a-form-item v-bind="validateInfos['meta.currency_code']" :label="$t('title.currencyCode')">
        <a-select
          v-model:value="vModel.meta.currency_code"
          class="w-52"
          show-search
          :filter-option="filterOption"
          :disabled="isMoney && isPg"
          dropdown-class-name="nc-dropdown-currency-cell-code"
        >
          <template #suffixIcon> <GeneralIcon icon="arrowDown" class="text-gray-700" /> </template>

          <a-select-option v-for="(currencyCode, i) of currencyList" :key="i" :value="currencyCode">
            <div class="flex gap-2 w-full justify-between items-center">
              {{ currencyCode }}
              <component
                :is="iconMap.check"
                v-if="vModel.meta.currency_code === currencyCode"
                id="nc-selected-item-icon"
                class="text-primary w-4 h-4"
              />
            </div>
          </a-select-option>
        </a-select>
      </a-form-item>
    </a-col>

    <a-col :span="24" class="mt-4">
      <a-form-item :label="$t('placeholder.precision')">
        <a-select
          v-if="vModel.meta?.precision || vModel.meta?.precision === 0"
          v-model:value="vModel.meta.precision"
          :disabled="isMoney && isPg"
          dropdown-class-name="nc-dropdown-decimal-format"
          @change="onPrecisionChange"
        >
          <template #suffixIcon>
            <GeneralIcon icon="arrowDown" class="text-gray-700" />
          </template>
          <a-select-option v-for="(format, i) of precisionFormats" :key="i" :value="format">
            <div class="flex gap-2 w-full justify-between items-center">
              {{ (precisionFormatsDisplay as any)[format] }}
              <component
                :is="iconMap.check"
                v-if="vModel.meta.precision === format"
                id="nc-selected-item-icon"
                class="text-primary w-4 h-4"
              />
            </div>
          </a-select-option>
        </a-select>
      </a-form-item>
    </a-col>

    <a-col v-if="isMoney && isPg">
      <span class="text-[#FB8C00]">{{ message }}</span>
    </a-col>
  </a-row>
</template>
