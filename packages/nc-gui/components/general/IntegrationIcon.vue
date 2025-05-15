<script lang="ts" setup>
const props = withDefaults(
  defineProps<{
    type: string
    size?: 'sx' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl'
  }>(),
  {
    size: 'sm',
  },
)

const { integrationsIconMap } = useIntegrationStore()
</script>

<template>
  <component
    :is="integrationsIconMap[props.type]"
    v-if="integrationsIconMap[props.type]"
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
