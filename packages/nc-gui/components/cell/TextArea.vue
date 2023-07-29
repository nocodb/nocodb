<script setup lang="ts">
import type { VNodeRef } from '@vue/runtime-core'
import { EditModeInj, IsExpandedFormOpenInj, RowHeightInj, inject, useVModel } from '#imports'

const props = defineProps<{
  modelValue?: string | number
}>()

const emits = defineEmits(['update:modelValue'])

const editEnabled = inject(EditModeInj)

const rowHeight = inject(RowHeightInj, ref(undefined))

const { showNull } = useGlobal()

const vModel = useVModel(props, 'modelValue', emits, { defaultValue: '' })

const isExpandedFormOpen = inject(IsExpandedFormOpenInj, ref(false))!

const focus: VNodeRef = (el) => !isExpandedFormOpen.value && (el as HTMLTextAreaElement)?.focus()

const height = computed(() => {
  if (!rowHeight.value) return 60

  return rowHeight.value * 60
})
</script>

<template>
  <textarea
    v-if="editEnabled"
    :ref="focus"
    v-model="vModel"
    rows="4"
    class="h-full w-full outline-none border-none"
    :class="`${editEnabled ? 'p-2' : ''}`"
    :style="{
      minHeight: `${height}px`,
    }"
    @blur="editEnabled = false"
    @keydown.alt.enter.stop
    @keydown.shift.enter.stop
    @keydown.down.stop
    @keydown.left.stop
    @keydown.right.stop
    @keydown.up.stop
    @keydown.delete.stop
    @keydown.ctrl.z.stop
    @keydown.meta.z.stop
    @selectstart.capture.stop
    @mousedown.stop
  />

  <span v-else-if="vModel === null && showNull" class="nc-null">NULL</span>

  <LazyCellClampedText v-else-if="rowHeight" :value="vModel" :lines="rowHeight" />

  <span v-else>{{ vModel }}</span>
</template>

<style>
textarea:focus {
  box-shadow: none;
}
</style>
