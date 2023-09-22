<script lang="ts" setup>
const props = withDefaults(
  defineProps<{
    color: string
    border?: boolean
  }>(),
  {
    border: true,
  },
)
</script>

<template>
  <div
    class="rounded-md px-1"
    :class="{
      'border-purple-500 bg-purple-100': props.color === 'purple',
      'border-blue-500 bg-blue-100': props.color === 'blue',
      'border-green-500 bg-green-100': props.color === 'green',
      'border-orange-500 bg-orange-100': props.color === 'orange',
      'border-yellow-500 bg-yellow-100': props.color === 'yellow',
      'border-red-500 bg-red-100': props.color === 'red',
      'border-gray-300': !props.color,
      'border-1': props.border,
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
