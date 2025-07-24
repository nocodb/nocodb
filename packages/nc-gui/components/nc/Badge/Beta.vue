<script lang="ts" setup>
import type { NcBadgeProps } from './index.vue'

const props = withDefaults(defineProps<NcBadgeProps>(), {
  border: false,
  color: 'brand',
  size: 'xs',
})
</script>

<template>
  <NcBadge v-bind="props" class="text-bodyDefaultSm">
    <slot>
      {{ $t('general.beta') }}
    </slot>
  </NcBadge>
</template>
