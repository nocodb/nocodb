<script lang="ts" setup>
import type { VNodeRef } from '@vue/runtime-core'
import { EditModeInj, ReadonlyInj, computed, inject, useVModel, validateEmail } from '#imports'

interface Props {
  modelValue: string | null | undefined
}

interface Emits {
  (event: 'update:modelValue', model: string): void
}

const props = defineProps<Props>()

const emits = defineEmits<Emits>()

const { showNull } = useGlobal()

const editEnabled = inject(EditModeInj)

const readonly = inject(ReadonlyInj, ref(false))

const vModel = useVModel(props, 'modelValue', emits)

const validEmail = computed(() => vModel.value && validateEmail(vModel.value))

const focus: VNodeRef = (el) => (el as HTMLInputElement)?.focus()
</script>

<template>
  <input
    v-if="!readonly && editEnabled"
    :ref="focus"
    v-model="vModel"
    class="outline-none text-sm px-2"
    @blur="editEnabled = false"
    @keydown.down.stop
    @keydown.left.stop
    @keydown.right.stop
    @keydown.up.stop
    @keydown.delete.stop
    @selectstart.capture.stop
    @mousedown.stop
  />

  <span v-else-if="vModel === null && showNull" class="nc-null">NULL</span>

  <a v-else-if="validEmail" class="text-sm underline hover:opacity-75" :href="`mailto:${vModel}`" target="_blank">
    {{ vModel }}
  </a>

  <span v-else>{{ vModel }}</span>
</template>
