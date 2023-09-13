<script lang="ts" setup>
const props = defineProps<{
  color: string
}>()
</script>

<template>
  <div
    class="border-1 h-6 rounded-md px-1"
    :class="{
      'border-purple-500 bg-purple-100': props.color === 'purple',
      'border-blue-500 bg-blue-100': props.color === 'blue',
      'border-green-500 bg-green-100': props.color === 'green',
      'border-orange-500 bg-orange-100': props.color === 'orange',
      'border-yellow-500 bg-yellow-100': props.color === 'yellow',
      'border-gray-300': !props.color,
    }"
  >
    <slot />
  </div>
</template>

<style>
.badge-color {
  @apply mt-1 w-23 border h-6 rounded-lg;
}
</style>
