<script setup lang="ts">
import type { VNodeRef } from '@vue/runtime-core'
import { EditColumnInj, EditModeInj, IsExpandedFormOpenInj, inject, useVModel } from '#imports'

interface Props {
  modelValue?: number | string | null
}

const props = defineProps<Props>()

const emits = defineEmits(['update:modelValue'])

const { showNull } = useGlobal()

const editEnabled = inject(EditModeInj)

const isEditColumn = inject(EditColumnInj, ref(false))

const _vModel = useVModel(props, 'modelValue', emits)

const vModel = computed({
  get: () => _vModel.value,
  set: (value) => {
    if (value === '') {
      _vModel.value = null
    } else {
      _vModel.value = value
    }
  },
})

const isExpandedFormOpen = inject(IsExpandedFormOpenInj, ref(false))!

const focus: VNodeRef = (el) => !isExpandedFormOpen.value && !isEditColumn.value && (el as HTMLInputElement)?.focus()
</script>

<template>
  <input
    v-if="editEnabled"
    :ref="focus"
    v-model="vModel"
    class="w-full !text-sm !border-none !outline-none focus:ring-0 text-base p-1"
    :class="{ '!px-2': editEnabled }"
    type="number"
    :placeholder="isEditColumn ? $t('labels.optional') : ''"
    @blur="editEnabled = false"
    @keydown.down.stop
    @keydown.left.stop
    @keydown.right.stop
    @keydown.up.stop
    @keydown.delete.stop
    @selectstart.capture.stop
    @mousedown.stop
  />
  <span v-else-if="vModel === null && showNull" class="nc-null capitalize">{{ $t('general.null') }}</span>
  <span v-else>{{ vModel }}</span>
</template>
