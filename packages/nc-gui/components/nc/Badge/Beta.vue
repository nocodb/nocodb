<script lang="ts" setup>
import type { NcBadgeProps } from './index.vue'

withDefaults(defineProps<NcBadgeProps>(), {
  border: false,
  color: 'brand',
  size: 'xs',
})
</script>

<template>
  <NcBadge :border="border" :color="color" :size="size" class="text-bodyDefaultSm">
    <slot>
      {{ $t('general.beta') }}
    </slot>
  </NcBadge>
</template>
