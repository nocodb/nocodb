<script setup lang="ts">
import type { VNodeRef } from '@vue/runtime-core'
import { EditModeInj, inject, useVModel } from '#imports'

interface Props {
  // when we set a number, then it is number type
  // for sqlite, when we clear a cell or empty the cell, it returns ""
  // otherwise, it is null type
  modelValue?: number | null | string
}

interface Emits {
  (event: 'update:modelValue', model: number): void
}

const props = defineProps<Props>()

const emits = defineEmits<Emits>()

const { showNull } = useGlobal()

const editEnabled = inject(EditModeInj)

const _vModel = useVModel(props, 'modelValue', emits)

const vModel = computed({
  get: () => _vModel.value,
  set: (value) => {
    if (value === '') {
      // if we clear / empty a cell in sqlite,
      // the value is considered as ''
      _vModel.value = null
    } else {
      _vModel.value = value
    }
  },
})

const focus: VNodeRef = (el) => (el as HTMLInputElement)?.focus()

function onKeyDown(evt: KeyboardEvent) {
  return evt.key === '.' && evt.preventDefault()
}
</script>

<template>
  <input
    v-if="editEnabled"
    :ref="focus"
    v-model="vModel"
    class="outline-none p-0 border-none w-full h-full text-sm"
    type="number"
    @blur="editEnabled = false"
    @keydown="onKeyDown"
    @keydown.down.stop
    @keydown.left.stop
    @keydown.right.stop
    @keydown.up.stop
    @keydown.delete.stop
    @selectstart.capture.stop
    @mousedown.stop
  />
  <span v-else-if="vModel === null && showNull" class="nc-null">NULL</span>
  <span v-else class="text-sm">{{ vModel }}</span>
</template>

<style scoped lang="scss">
input[type='number']:focus {
  @apply ring-transparent;
}
</style>
