<script lang="ts" setup>
import type { NcBadgeProps } from './index.vue'

const props = withDefaults(defineProps<NcBadgeProps>(), {
  border: false,
  color: 'gray',
  size: 'xs',
})
</script>

<template>
  <NcBadge v-bind="props" class="text-bodySm">
    <slot>
      {{ $t('title.comingSoon') }}
    </slot>
  </NcBadge>
</template>
