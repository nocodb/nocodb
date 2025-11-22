<script lang="ts" setup>
export interface NcBadgeProps {
  color?: string
  border?: boolean
  size?: 'xs' | 'sm' | 'md' | 'lg'
  rounded?: 'sm' | 'md' | 'lg'
}

const props = withDefaults(defineProps<NcBadgeProps>(), {
  border: true,
  size: 'sm',
  rounded: 'md',
})
</script>

<template>
  <div
    :class="{
      'border-nc-purple-500 bg-nc-bg-purple-dark': props.color === 'purple',
      'border-nc-blue-500 bg-nc-bg-blue-dark': props.color === 'blue',
      'border-nc-green-500 bg-nc-bg-green-dark': props.color === 'green',
      'border-nc-orange-500 bg-nc-bg-orange-dark': props.color === 'orange',
      'border-nc-yellow-500 bg-nc-bg-yellow-dark': props.color === 'yellow',
      'border-nc-red-500 bg-nc-bg-red-dark': props.color === 'red',
      'border-nc-maroon-500 bg-nc-bg-marooon': props.color === 'maroon',
      'border-nc-gray-500 bg-nc-bg-gray-extralight': props.color === 'gray',
      'bg-nc-bg-brand text-nc-content-brand': props.color === 'brand',
      'bg-nc-bg-coloured-purple text-nc-content-purple-medium': props.color === 'ai',
      'border-nc-border-gray-dark': !props.color,
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
