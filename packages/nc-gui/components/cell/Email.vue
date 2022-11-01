<script lang="ts" setup>
import type { VNodeRef } from '@vue/runtime-core'
import { EditModeInj, computed, inject, isEmail, useVModel } from '#imports'

interface Props {
  modelValue: string | null | undefined
}

interface Emits {
  (event: 'update:modelValue', model: string): void
}

const props = defineProps<Props>()

const emits = defineEmits<Emits>()

const editEnabled = inject(EditModeInj)

const vModel = useVModel(props, 'modelValue', emits)

const validEmail = computed(() => vModel.value && isEmail(vModel.value))

const focus: VNodeRef = (el) => (el as HTMLInputElement)?.focus()
</script>

<template>
  <input
    v-if="editEnabled"
    :ref="focus"
    v-model="vModel"
    class="outline-none text-sm px-2"
    @blur="editEnabled = false"
    @keydown.down.stop
    @keydown.left.stop
    @keydown.right.stop
    @keydown.up.stop
    @keydown.delete.stop
  />

  <a v-else-if="validEmail" class="text-sm underline hover:opacity-75" :href="`mailto:${vModel}`" target="_blank">
    {{ vModel }}
  </a>

  <span v-else>{{ vModel }}</span>
</template>
