<script setup lang="ts">
import type { VNodeRef } from '@vue/runtime-core'
import { EditModeInj, inject, useVModel } from '#imports'

const props = defineProps<{
  modelValue?: string
}>()

const emits = defineEmits(['update:modelValue'])

const editEnabled = inject(EditModeInj)

const vModel = useVModel(props, 'modelValue', emits, { defaultValue: '' })

const focus: VNodeRef = (el) => (el as HTMLTextAreaElement)?.focus()
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
  />

  <span v-else>{{ vModel }}</span>
</template>
