<script lang="ts" setup>
import type { NcBadgeProps } from './index.vue'

const props = withDefaults(defineProps<NcBadgeProps>(), {
  border: false,
  color: 'gray',
  size: 'xs',
})
</script>

<template>
  <NcBadge v-bind="props" class="text-bodyDefaultSm">
    <slot>
      {{ $t('general.comingsoon') }}
    </slot>
  </NcBadge>
</template>
