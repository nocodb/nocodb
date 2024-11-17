<script setup lang="ts">
import { useCarousel } from './useCarousel'
import type { WithClassAsProps } from './interface'

const props = defineProps<WithClassAsProps>()

const { carouselRef, orientation } = useCarousel()

defineOptions({
  inheritAttrs: false,
})
</script>

<template>
  <div ref="carouselRef" class="overflow-hidden carousel-container">
    <div
      :class="{
        'flex-col': orientation === 'vertical',
        [props.class]: props.class,
      }"
      class="flex embla__container"
      v-bind="$attrs"
    >
      <slot />
    </div>
  </div>
</template>
