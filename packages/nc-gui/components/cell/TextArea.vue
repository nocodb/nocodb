<script setup lang="ts">
import type { VNodeRef } from '@vue/runtime-core'
import { EditModeInj, computed, inject } from '#imports'

interface Props {
  modelValue: string | null | undefined
}

const { modelValue } = defineProps<Props>()

const emits = defineEmits(['update:modelValue'])

const editEnabled = inject(EditModeInj)

const vModel = computed({
  get: () => modelValue ?? '',
  set: (value) => emits('update:modelValue', value),
})

const focus: VNodeRef = (el) => (el as HTMLTextAreaElement)?.focus()
</script>

<template>
  <textarea
    v-if="editEnabled"
    :ref="focus"
    v-model="vModel"
    rows="4"
    class="h-full w-full min-h-[60px] outline-none"
    @blur="editEnabled = false"
    @keydown.alt.enter.stop
    @keydown.shift.enter.stop
  />

  <span v-else>{{ vModel }}</span>
</template>
