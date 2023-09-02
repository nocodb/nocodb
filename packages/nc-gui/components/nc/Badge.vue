<script lang="ts" setup>
import { computed } from 'vue'

const props = defineProps<{
  color: string
}>()
</script>

<template>
  <div
    class="badge-color"
    :class="{
      'border-purple-500': props.color === 'purple',
      'bg-purple-100': props.color === 'purple',
      'border-blue-500': props.color === 'blue',
      'bg-blue-100': props.color === 'blue',
      'border-green-500': props.color === 'green',
      'bg-green-100': props.color === 'green',
      'border-orange-500': props.color === 'orange',
      'bg-orange-100': props.color === 'orange',
      'border-yellow-500': props.color === 'yellow',
      'bg-yellow-100': props.color === 'yellow',
    }"
  >
    <slot></slot>
  </div>
</template>

<style>
.badge-color {
  @apply mt-1 border px-2 h-6 rounded-lg;
}
</style>
