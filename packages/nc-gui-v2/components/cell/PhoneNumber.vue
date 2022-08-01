<script setup lang="ts">
import Text from './Text.vue'
import { computed } from '#imports'

interface Props {
  modelValue: any
}

const { modelValue: value } = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const localState = computed({
  get: () => value,
  set: (val) => emit('update:modelValue', val),
})
</script>

<template>
  <Text v-model="localState" />
</template>

<style scoped>
input,
textarea {
  width: 100%;
  height: 100%;
  color: var(--v-textColor-base);
  outline: none;
}
</style>
