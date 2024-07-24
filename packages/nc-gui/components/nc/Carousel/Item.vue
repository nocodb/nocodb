<script setup lang="ts">
import { useCarousel } from './useCarousel'
import type { WithClassAsProps } from './interface'

const props = defineProps<WithClassAsProps>()

const { orientation } = useCarousel()
</script>

<template>
  <div
    role="group"
    aria-roledescription="slide"
    :class="{
      [props.class]: props.class,
    }"
    class="min-w-0 shrink-0 embla__slide grow-0 basis-full"
  >
    <slot />
  </div>
</template>
