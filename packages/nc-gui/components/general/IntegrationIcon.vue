<script lang="ts" setup>
const props = withDefaults(
  defineProps<{
    type: keyof typeof allIntegrationsMapByValue
    size: 'sx' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl'
  }>(),
  {
    size: 'sm',
  },
)
</script>

<template>
  <component
    v-if="allIntegrationsMapByValue[props.type]?.icon"
    :is="allIntegrationsMapByValue[props.type]?.icon"
    class="stroke-transparent flex-none"
    :class="{
      'w-3.5 h-3.5': size === 'sx',
      'w-4 h-4': size === 'sm',
      'w-5 h-5': size === 'md',
      'w-6 h-6': size === 'lg',
      'w-7 h-7': size === 'xl',
      'w-8 h-8': size === 'xxl',
    }"
  />
</template>
