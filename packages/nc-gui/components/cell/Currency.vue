<script setup lang="ts">
import type { VNodeRef } from '@vue/runtime-core'
import { ColumnInj, EditModeInj, IsExpandedFormOpenInj, computed, inject, parseProp, useVModel } from '#imports'

interface Props {
  modelValue: number | null | undefined
}

const props = defineProps<Props>()

const emit = defineEmits(['update:modelValue', 'save'])

const { showNull } = useGlobal()

const column = inject(ColumnInj)!

const editEnabled = inject(EditModeInj)!

const _vModel = useVModel(props, 'modelValue', emit)

const vModel = computed({
  get: () => _vModel.value,
  set: (value: unknown) => {
    if (value === '') {
      _vModel.value = null
    } else {
      _vModel.value = value as number
    }
  },
})

const lastSaved = ref()

const currencyMeta = computed(() => {
  return {
    currency_locale: 'en-US',
    currency_code: 'USD',
    ...parseProp(column?.value?.meta),
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

const isExpandedFormOpen = inject(IsExpandedFormOpenInj)!

const focus: VNodeRef = (el) => !isExpandedFormOpen && (el as HTMLInputElement)?.focus()

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
    type="number"
    class="w-full h-full border-none outline-none px-2"
    @blur="submitCurrency"
    @keydown.down.stop
    @keydown.left.stop
    @keydown.right.stop
    @keydown.up.stop
    @keydown.delete.stop
    @selectstart.capture.stop
    @mousedown.stop
    @contextmenu.stop
  />

  <span v-else-if="vModel === null && showNull" class="nc-null">NULL</span>

  <!-- only show the numeric value as previously string value was accepted -->
  <span v-else-if="/^\d+(\.\d+)?$/.test(vModel)">{{ currency }}</span>

  <!-- possibly unexpected string / null with showNull == false  -->
  <span v-else />
</template>
