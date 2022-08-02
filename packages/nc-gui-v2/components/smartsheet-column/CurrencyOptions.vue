<script setup lang="ts">
import { useColumnCreateStoreOrThrow, useProject } from '#imports'
import { currencyCodes, currencyLocales, validateCurrencyCode, validateCurrencyLocale } from '@/utils/currencyUtils'

interface Option {
  label: string
  value: string
}

const { formState, validateInfos, setAdditionalValidations, sqlUi, onDataTypeChange, onAlter } = useColumnCreateStoreOrThrow()

// set additional validations
setAdditionalValidations({
  'meta.currency_locale': [isValidCurrencyLocale],
  'meta.currency_code': [isValidCurrencyCode],
})

const { isPg } = useProject()

const colMeta = ref({
  currency_locale: 'en-US',
  currency_code: 'USD',
})

const currencyList = ref(currencyCodes)

const currencyLocaleList = ref(currencyLocales())

function isValidCurrencyLocale(locale: string) {
  return validateCurrencyLocale(locale) || 'Invalid locale'
}

function isValidCurrencyCode(currencyCode: string) {
  return validateCurrencyLocale(currencyCode) || 'Invalid Currency Code'
}

const isMoney = computed(() => formState.value.dt === 'money')

const message = computed(() => {
  if (isMoney && isPg) return "PostgreSQL 'money' type has own currency settings"
  return ''
})

function filterOption(input: string, option: Option) {
  return option.value.toUpperCase().includes(input.toUpperCase())
}
</script>

<template>
  <a-tooltip>
    <template #title>
      <span> {{ message }} </span>
    </template>
    <a-row>
      <a-col :span="12">
        <!--label="Currency Locale"-->
        <a-form-item v-bind="validateInfos.meta.currency_locale">
          <a-select
            v-model:value="formState.meta.currency_locale"
            class="w-52"
            show-search
            :options="currencyLocaleList"
            :filter-option="filterOption"
          />
        </a-form-item>
      </a-col>
      <a-col :span="12">
        <!--label="Currency Code"-->
        <a-form-item v-bind="validateInfos.meta.currency_code">
          <a-select
            v-model:value="formState.meta.currency_code"
            class="w-52"
            show-search
            :options="currencyList"
            :filter-option="filterOption"
          />
        </a-form-item>
      </a-col>
    </a-row>
  </a-tooltip>
</template>
