<script setup lang="ts">
import { EditModeInj, inject, useVModel } from '#imports'

interface Props {
  modelValue: number | string | null | undefined
}

const props = defineProps<Props>()

const emits = defineEmits(['update:modelValue'])

const editEnabled = inject(EditModeInj)

const vModel = useVModel(props, 'modelValue', emits)
</script>

<template>
  <input v-if="editEnabled" v-model="vModel" type="number" />

  <span v-else>{{ vModel }}</span>
</template>
