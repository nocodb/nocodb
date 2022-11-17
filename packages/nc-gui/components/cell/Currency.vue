<script setup lang="ts">
import type { VNodeRef } from '@vue/runtime-core'
import { ColumnInj, EditModeInj, computed, inject, useVModel } from '#imports'

interface Props {
  modelValue: number | null | undefined
}

const props = defineProps<Props>()

const emit = defineEmits(['update:modelValue', 'save'])

const column = inject(ColumnInj)!

const editEnabled = inject(EditModeInj)!

const vModel = useVModel(props, 'modelValue', emit)

const lastSaved = ref()

const currencyMeta = computed(() => {
  return {
    currency_locale: 'en-US',
    currency_code: 'USD',
    ...(column.value.meta ? column.value.meta : {}),
  }
})

const currency = computed(() => {
  try {
    return !vModel.value || isNaN(vModel.value)
      ? vModel.value
      : new Intl.NumberFormat(currencyMeta.value.currency_locale || 'en-US', {
          style: 'currency',
          currency: currencyMeta.value.currency_code || 'USD',
        }).format(vModel.value)
  } catch (e) {
    return vModel.value
  }
})

const focus: VNodeRef = (el) => (el as HTMLInputElement)?.focus()

const submitCurrency = () => {
  if (lastSaved.value !== vModel.value) {
    lastSaved.value = vModel.value
    emit('save')
  }
  editEnabled.value = false
}

onMounted(() => {
  lastSaved.value = vModel.value
})
</script>

<template>
  <input
    v-if="editEnabled"
    :ref="focus"
    v-model="vModel"
    class="w-full h-full border-none outline-none px-2"
    @blur="submitCurrency"
    @keydown.down.stop
    @keydown.left.stop
    @keydown.right.stop
    @keydown.up.stop
    @keydown.delete.stop
  />

  <span v-else-if="vModel">{{ currency }}</span>

  <span v-else />
</template>
