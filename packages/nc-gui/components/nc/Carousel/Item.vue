<script setup lang="ts">
import type { WithClassAsProps } from './interface'

const props = defineProps<WithClassAsProps>()
</script>

<template>
  <div
    role="group"
    aria-roledescription="slide"
    :class="{
      [props.class]: props.class,
    }"
    class="min-w-0 shrink-0 flex justify-center items-center embla__slide h-full grow-0 basis-full"
  >
    <slot />
  </div>
</template>
