<script setup lang="ts">
import { useColumnCreateStoreOrThrow, useProject } from '#imports'
import { currencyCodes, currencyLocales, validateCurrencyCode, validateCurrencyLocale } from '@/utils/currencyUtils'

const { formState, validateInfos, setAdditionalValidations, sqlUi, onDataTypeChange, onAlter } = useColumnCreateStoreOrThrow()

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
</script>

<template>
  <a-tooltip>
    <template #title>
      <span> {{ message }} </span>
    </template>
    <a-row>
      <a-col :span="12">
        <!--label="Format Locale"-->
      </a-col>
      <a-col :span="12">
        <!--label="Currency Code"-->
      </a-col>
    </a-row>
  </a-tooltip>
</template>