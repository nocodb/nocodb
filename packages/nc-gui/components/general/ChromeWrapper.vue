<script lang="ts" setup>
import { Chrome } from '@ckpack/vue-color'

interface Props {
  modelValue?: any
  mode?: 'hex' | 'hex8' | 'hsl' | 'hsv' | 'rgba'
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: () => '#00FFFFFF',
  mode: () => 'hex8',
})

const emit = defineEmits(['update:modelValue', 'input'])

const picked = computed({
  get: () => props.modelValue || '#00FFFFFF',
  set: (val) => {
    emit('update:modelValue', val[props.mode] || null)
    emit('input', val[props.mode] || null)
  },
})
</script>

<template>
  <Chrome v-model="picked" />
</template>
