<script setup lang="ts">
import { computed, inject } from '#imports'
import { ColumnInj } from '~/components'

const column = inject(ColumnInj)
const editEnabled = inject<boolean>('editEnabled')

interface Props {
  modelValue: number
}
const { modelValue: value } = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const root = ref<HTMLInputElement>()

const localState = computed({
  get: () => value,
  set: (val) => emit('update:modelValue', val),
})

const currencyMeta = computed(() => {
  return {
    currency_locale: 'en-US',
    currency_code: 'USD',
    ...(column && column.meta ? column.meta : {}),
  }
})
const currency = computed(() => {
  try {
    return isNaN(value)
      ? value
      : new Intl.NumberFormat(currencyMeta?.value?.currency_locale || 'en-US', {
          style: 'currency',
          currency: currencyMeta?.value?.currency_code || 'USD',
        }).format(value)
  } catch (e) {
    return value
  }
})
</script>

<template>
  <input v-if="editEnabled" ref="root" v-model="localState" />
  <span v-else-if="value">{{ currency }}</span>
  <span v-else />
</template>

<style scoped></style>
