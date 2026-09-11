<script setup lang="ts">
import { ColumnHelper, UITypes, getCurrencyFormatOptions, roundUpToPrecision } from 'nocodb-sdk'

interface Props {
  modelValue: number | null | undefined
}

const props = defineProps<Props>()

const column = inject(ColumnInj)!

const currencyMeta = computed(() => {
  return {
    ...ColumnHelper.getColumnDefaultMeta(UITypes.Currency),
    ...parseProp(column?.value?.meta),
  }
})

const currency = computed(() => {
  try {
    if (props.modelValue === null || props.modelValue === undefined || isNaN(props.modelValue)) {
      return props.modelValue
    }

    // Round the value to the specified precision
    const roundedValue = roundUpToPrecision(Number(props.modelValue), currencyMeta.value.precision ?? 2)

    return new Intl.NumberFormat(
      currencyMeta.value.currency_locale || 'en-US',
      getCurrencyFormatOptions(currencyMeta.value),
    ).format(roundedValue)
  } catch (e) {
    return props.modelValue
  }
})
</script>

<template>
  <!-- only show the numeric value as previously string value was accepted -->
  <div v-if="!isNaN(props.modelValue)" class="nc-cell-field truncate">{{ currency }}</div>

  <!-- possibly unexpected string / null with showNull == false  -->
  <span v-else />
</template>
