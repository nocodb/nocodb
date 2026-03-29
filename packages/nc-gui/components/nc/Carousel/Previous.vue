<script setup lang="ts">
import type { WithClassAsProps } from './interface'
import { useCarousel } from './useCarousel'

const props = defineProps<WithClassAsProps>()

const { orientation, canScrollPrev, scrollPrev } = useCarousel()
</script>

<template>
  <NcButton
    :disabled="!canScrollPrev"
    type="secondary"
    size="xsmall"
    :class="{
      'rotate-90': orientation === 'vertical',
      [props.class]: props.class,
    }"
    class="!absolute"
    @click="scrollPrev"
  >
    <slot>
      <GeneralIcon icon="arrowLeft" class="h-4 w-4 text-current" />
    </slot>
  </NcButton>
</template>
