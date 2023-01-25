<script lang="ts" setup>
import type { VNodeRef } from '@vue/runtime-core'
import { EditModeInj, inject, useVModel } from '#imports'

interface Props {
  modelValue?: number | null
}

interface Emits {
  (event: 'update:modelValue', model: number): void
}

const props = defineProps<Props>()

const emits = defineEmits<Emits>()

const editEnabled = inject(EditModeInj)

const _vModel = useVModel(props, 'modelValue', emits)

const vModel = computed({
  get: () => _vModel.value,
  set: (value: string) => {
    if (value === '') {
      _vModel.value = null
    } else {
      _vModel.value = value
    }
  },
})

const focus: VNodeRef = (el) => (el as HTMLInputElement)?.focus()
</script>

<template>
  <input
    v-if="editEnabled"
    :ref="focus"
    v-model="vModel"
    class="outline-none p-0 border-none w-full h-full text-sm"
    type="number"
    step="0.1"
    @blur="editEnabled = false"
    @keydown.down.stop
    @keydown.left.stop
    @keydown.right.stop
    @keydown.up.stop
    @keydown.delete.stop
    @selectstart.capture.stop
    @mousedown.stop
  />
  <span v-else-if="vModel === null" class="nc-null">NULL</span>
  <span v-else class="text-sm">{{ vModel }}</span>
</template>

<style scoped lang="scss">
input[type='number']:focus {
  @apply ring-transparent;
}
</style>
