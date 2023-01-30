<script setup lang="ts">
import { computed, currencyCodes, currencyLocales, useVModel, validateCurrencyCode, validateCurrencyLocale } from '#imports'

interface Option {
  label: string
  value: string
}

const props = defineProps<{
  value: any
}>()

const emit = defineEmits(['update:value'])

const vModel = useVModel(props, 'value', emit)

const validators = {
  'meta.currency_locale': [
    {
      validator: (_: any, locale: any) => {
        return new Promise<void>((resolve, reject) => {
          if (!validateCurrencyLocale(locale)) {
            return reject(new Error('Invalid locale'))
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
            return reject(new Error('Invalid Currency Code'))
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

const currencyLocaleList = currencyLocales() || []

const isMoney = computed(() => vModel.value.dt === 'money')

const message = computed(() => {
  if (isMoney.value && isPg.value) return "PostgreSQL 'money' type has own currency settings"
  return ''
})

function filterOption(input: string, option: Option) {
  return option.value.toUpperCase().includes(input.toUpperCase())
}

// set default value
vModel.value.meta = {
  currency_locale: 'en-US',
  currency_code: 'USD',
  ...vModel.value.meta,
}
</script>

<template>
  <a-row gutter="8">
    <a-col :span="12">
      <a-form-item v-bind="validateInfos['meta.currency_locale']" label="Currency Locale">
        <a-select
          v-model:value="vModel.meta.currency_locale"
          class="w-52"
          show-search
          :filter-option="filterOption"
          :disabled="isMoney && isPg"
          dropdown-class-name="nc-dropdown-currency-cell-locale"
        >
          <a-select-option v-for="(currencyLocale, i) of currencyLocaleList" :key="i" :value="currencyLocale.value">
            {{ currencyLocale.text }}
          </a-select-option>
        </a-select>
      </a-form-item>
    </a-col>

    <a-col :span="12">
      <a-form-item v-bind="validateInfos['meta.currency_code']" label="Currency Code">
        <a-select
          v-model:value="vModel.meta.currency_code"
          class="w-52"
          show-search
          :filter-option="filterOption"
          :disabled="isMoney && isPg"
          dropdown-class-name="nc-dropdown-currency-cell-code"
        >
          <a-select-option v-for="(currencyCode, i) of currencyList" :key="i" :value="currencyCode">
            {{ currencyCode }}
          </a-select-option>
        </a-select>
      </a-form-item>
    </a-col>

    <a-col v-if="isMoney && isPg">
      <span class="text-[#FB8C00]">{{ message }}</span>
    </a-col>
  </a-row>
</template>
