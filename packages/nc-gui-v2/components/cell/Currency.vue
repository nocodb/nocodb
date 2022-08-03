<script setup lang="ts">
import { computed, inject, ref, useVModel } from '#imports'
import { ColumnInj, EditModeInj } from '~/context'

interface Props {
  modelValue: number
}

const props = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const column = inject(ColumnInj)

const editEnabled = inject(EditModeInj, ref(false))

const root = ref<HTMLInputElement>()

const vModel = useVModel(props, 'modelValue', emit)

const currencyMeta = computed(() => {
  return {
    currency_locale: 'en-US',
    currency_code: 'USD',
    ...(column && column.meta ? column.meta : {}),
  }
})
const currency = computed(() => {
  try {
    return isNaN(vModel.value)
      ? vModel.value
      : new Intl.NumberFormat(currencyMeta?.value?.currency_locale || 'en-US', {
          style: 'currency',
          currency: currencyMeta?.value?.currency_code || 'USD',
        }).format(vModel.value)
  } catch (e) {
    return vModel.value
  }
})
</script>

<template>
  <input v-if="editEnabled" ref="root" v-model="vModel" />
  <span v-else-if="vModel">{{ currency }}</span>
  <span v-else />
</template>
