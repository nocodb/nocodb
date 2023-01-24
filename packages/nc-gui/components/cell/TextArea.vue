<script setup lang="ts">
import type { GridType } from 'nocodb-sdk'
import type { VNodeRef } from '@vue/runtime-core'
import { ActiveViewInj, EditModeInj, inject, useVModel } from '#imports'

const props = defineProps<{
  modelValue?: string | number
}>()

const emits = defineEmits(['update:modelValue'])

const editEnabled = inject(EditModeInj)

const view = inject(ActiveViewInj, ref())

const vModel = useVModel(props, 'modelValue', emits, { defaultValue: '' })

const focus: VNodeRef = (el) => (el as HTMLTextAreaElement)?.focus()

const rowHeight = computed(() => {
  if ((view.value?.view as GridType)?.row_height !== undefined) {
    switch ((view.value?.view as GridType)?.row_height) {
      case 0:
        return 1
      case 1:
        return 2
      case 2:
        return 4
      case 3:
        return 6
      default:
        return 1
    }
  }
})
</script>

<template>
  <textarea
    v-if="editEnabled"
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

  <LazyCellClampedText v-else-if="rowHeight" :value="vModel" :lines="rowHeight" />

  <span v-else>{{ vModel }}</span>
</template>
