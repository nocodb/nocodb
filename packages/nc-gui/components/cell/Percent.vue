<script setup lang="ts">
import { EditModeInj, inject, useVModel } from '#imports'

interface Props {
  modelValue?: number | string | null
}

const props = defineProps<Props>()

const emits = defineEmits(['update:modelValue'])

const editEnabled = inject(EditModeInj)

const vModel = useVModel(props, 'modelValue', emits)
</script>

<template>
  <input
    v-if="editEnabled"
    v-model="vModel"
    class="w-full !border-none text-base"
    :class="{ '!px-2': editEnabled }"
    type="number"
    @keydown.down.stop
    @keydown.left.stop
    @keydown.right.stop
    @keydown.up.stop
    @keydown.delete.stop
  />
  <span v-else>{{ vModel }}</span>
</template>
