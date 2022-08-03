<script setup lang="ts">
import { useColumnCreateStoreOrThrow, useProject } from '#imports'
import { currencyCodes, currencyLocales, validateCurrencyCode, validateCurrencyLocale } from '@/utils/currencyUtils'

interface Option {
  label: string
  value: string
}

const { formState, validateInfos, setAdditionalValidations, sqlUi, onDataTypeChange, onAlter } = useColumnCreateStoreOrThrow()

const validators = computed(() => {
  return {
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
})

// set additional validations
setAdditionalValidations({
  ...validators.value,
})

const { isPg } = useProject()

const currencyList = ref(currencyCodes)

const currencyLocaleList = ref(currencyLocales())

const isMoney = computed(() => formState.value.dt === 'money')

const message = computed(() => {
  if (isMoney.value && isPg) return "PostgreSQL 'money' type has own currency settings"
  return ''
})

function filterOption(input: string, option: Option) {
  return option.value.toUpperCase().includes(input.toUpperCase())
}
</script>

<template>
  <a-tooltip :visible="isMoney && isPg">
    <template #title>
      <span>{{ message }}</span>
    </template>
    <a-row>
      <a-col :span="12">
        <a-form-item v-bind="validateInfos['meta.currency_locale']" label="Currency Locale">
          <a-select
            v-model:value="formState.meta.currency_locale"
            size="small"
            class="w-52"
            show-search
            :filter-option="filterOption"
            :disabled="isMoney && isPg"
          >
            <a-select-option v-for="(currencyLocale, i) in currencyLocaleList ?? []" :key="i" :value="currencyLocale.value">
              {{ currencyLocale.text }}
            </a-select-option>
          </a-select>
        </a-form-item>
      </a-col>
      <a-col :span="12">
        <a-form-item v-bind="validateInfos['meta.currency_code']" label="Currency Code">
          <a-select
            v-model:value="formState.meta.currency_code"
            class="w-52"
            show-search
            :filter-option="filterOption"
            size="small"
            :disabled="isMoney && isPg"
          >
            <a-select-option v-for="(currencyCode, i) in currencyList ?? []" :key="i" :value="currencyCode">
              {{ currencyCode }}
            </a-select-option>
          </a-select>
        </a-form-item>
      </a-col>
    </a-row>
  </a-tooltip>
</template>
