<script setup lang="ts">
import type { VNodeRef } from '@vue/runtime-core'
import { EditModeInj, RowHeightInj, inject, useVModel } from '#imports'

const props = defineProps<{
  modelValue?: string | number
}>()

const emits = defineEmits(['update:modelValue'])

const editEnabled = inject(EditModeInj)

const rowHeight = inject(RowHeightInj)

const { showNull } = useGlobal()

const vModel = useVModel(props, 'modelValue', emits, { defaultValue: '' })

const focus: VNodeRef = (el) => (el as HTMLTextAreaElement)?.focus()
</script>

<template>
  <textarea
    v-if="true || editEnabled"
    :ref="focus"
    v-model="vModel"
    rows="4"
    class="h-full w-full min-h-[60px] outline-none border-none"
    :class="{ 'p-2': editEnabled }"
    @blur="editEnabled = false"
    @keydown.alt.enter.stop
    @keydown.shift.enter.stop
    @keydown.down.stop
    @keydown.left.stop
    @keydown.right.stop
    @keydown.up.stop
    @keydown.delete.stop
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
