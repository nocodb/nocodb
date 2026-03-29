<script setup lang="ts">
import type { WithClassAsProps } from './interface'
import { useCarousel } from './useCarousel'

defineOptions({
  inheritAttrs: false,
})

const props = defineProps<WithClassAsProps>()

const { carouselRef, orientation } = useCarousel()
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
