<script setup lang="ts">
interface Props {
  modelValue: number | null | undefined
}

const props = defineProps<Props>()

const column = inject(ColumnInj)!

const currencyMeta = computed(() => {
  return {
    currency_locale: 'en-US',
    currency_code: 'USD',
    ...parseProp(column?.value?.meta),
  }
})

const currency = computed(() => {
  try {
    if (props.modelValue === null || props.modelValue === undefined || isNaN(props.modelValue)) {
      return props.modelValue
    }
    return new Intl.NumberFormat(currencyMeta.value.currency_locale || 'en-US', {
      style: 'currency',
      currency: currencyMeta.value.currency_code || 'USD',
    }).format(props.modelValue)
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
