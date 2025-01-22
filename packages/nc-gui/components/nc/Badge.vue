<script lang="ts" setup>
const props = withDefaults(
  defineProps<{
    color?: string
    border?: boolean
    size?: 'xs' | 'sm' | 'md' | 'lg'
    rounded?: 'sm' | 'md' | 'lg'
  }>(),
  {
    border: true,
    size: 'sm',
    rounded: 'md',
  },
)
</script>

<template>
  <div
    :class="{
      'border-purple-500 bg-purple-100': props.color === 'purple',
      'border-blue-500 bg-blue-100': props.color === 'blue',
      'border-green-500 bg-green-100': props.color === 'green',
      'border-orange-500 bg-orange-100': props.color === 'orange',
      'border-yellow-500 bg-yellow-100': props.color === 'yellow',
      'border-red-500 bg-red-100': props.color === 'red',
      'border-maroon-500 bg-maroon-50': props.color === 'maroon',
      'border-gray-500 bg-gray-50': props.color === 'grey',
      'bg-brand-50 text-brand-500': props.color === 'brand',
      'border-gray-300': !props.color,
      'border-1': props.border,
      'h-5': props.size === 'xs',
      'h-6': props.size === 'sm',
      'h-8': props.size === 'md',
      'h-10': props.size === 'lg',
      'rounded-sm': props.rounded === 'sm',
      'rounded-md': props.rounded === 'md',
      'rounded-lg': props.rounded === 'lg',
    }"
    class="px-1 flex items-center"
  >
    <slot />
  </div>
</template>

<style>
.badge-color {
  @apply mt-1 w-23 border h-6 rounded-lg;
}
</style>
