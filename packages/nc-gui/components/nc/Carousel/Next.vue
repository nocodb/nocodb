<script setup lang="ts">
import type { WithClassAsProps } from './interface'
import { useCarousel } from './useCarousel'

const props = defineProps<WithClassAsProps>()

const { orientation, canScrollNext, scrollNext } = useCarousel()
</script>

<template>
  <NcButton
    :disabled="!canScrollNext"
    type="secondary"
    size="xsmall"
    :class="{
      'rotate-90': orientation === 'vertical',
      [props.class]: props.class,
    }"
    class="absolute"
    @click="scrollNext"
  >
    <slot>
      <GeneralIcon icon="arrowRight" class="h-4 w-4 text-current" />
    </slot>
  </NcButton>
</template>
