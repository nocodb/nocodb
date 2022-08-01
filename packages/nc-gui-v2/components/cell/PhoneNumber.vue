<script setup lang="ts">
import Text from './Text.vue'
import { computed } from '#imports'

interface Props {
  modelValue: any
}

const { modelValue: value } = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const VModal = computed({
  get: () => value,
  set: (val) => emit('update:modelValue', val),
})
</script>

<template>
  <Text v-model="VModal" />
</template>

<style scoped></style>
