<script setup lang="ts">
import Text from './Text.vue'

interface Props {
  modelValue: any
}

interface Emits {
  (event: 'update:modelValue', model: number): void
}

const props = defineProps<Props>()

const emits = defineEmits<Emits>()

const vModel = useVModel(props, 'modelValue', emits)

</script>

<template>
  <Text v-model="vModel" />
</template>

<style scoped></style>
