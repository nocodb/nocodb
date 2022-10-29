<script setup lang="ts">
import { useVModel } from '#imports'

interface Props {
  modelValue: any
}

interface Emits {
  (event: 'update:modelValue', model: string): void
}

const props = defineProps<Props>()

const emits = defineEmits<Emits>()

const vModel = useVModel(props, 'modelValue', emits)
</script>

<template>
  <LazyCellText v-model="vModel" />
</template>
