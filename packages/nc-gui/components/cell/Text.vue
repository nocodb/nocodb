<script setup lang="ts">
import type { VNodeRef } from '@vue/runtime-core'
import { EditModeInj, inject, useVModel } from '#imports'

interface Props {
  modelValue?: string | null
}

const props = defineProps<Props>()

const emits = defineEmits(['update:modelValue'])

const editEnabled = inject(EditModeInj)

const vModel = useVModel(props, 'modelValue', emits)

const focus: VNodeRef = (el) => (el as HTMLInputElement)?.focus()
</script>

<template>
  <input
    v-if="editEnabled"
    :ref="focus"
    v-model="vModel"
    class="h-full w-full outline-none bg-transparent"
    @blur="editEnabled = false"
  />

  <span v-else>{{ vModel }}</span>
</template>
