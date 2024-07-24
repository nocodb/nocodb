<script setup lang="ts">
import { useProvideCarousel } from './useCarousel'
import type { CarouselEmits, CarouselProps, WithClassAsProps } from './interface'

const props = withDefaults(defineProps<CarouselProps & WithClassAsProps>(), {
  orientation: 'horizontal',
})

const emits = defineEmits<CarouselEmits>()

const carouselArgs = useProvideCarousel(props, emits)

onMounted(() => {
  document.addEventListener('keydown', onKeyDown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeyDown)
})

function onKeyDown(event: KeyboardEvent) {
  const prevKey = props.orientation === 'vertical' ? 'ArrowUp' : 'ArrowLeft'
  const nextKey = props.orientation === 'vertical' ? 'ArrowDown' : 'ArrowRight'

  if (event.key === prevKey) {
    event.preventDefault()
    carouselArgs.scrollPrev()
    return
  }

  if (event.key === nextKey) {
    event.preventDefault()
    carouselArgs.scrollNext()
  }
}

defineExpose(carouselArgs)
</script>

<template>
  <div
    :class="{
      [props.class]: props.class,
    }"
    class="relative embla !focus-visible:outline-none"
    role="region"
    aria-roledescription="carousel"
    tabindex="0"
  >
    <slot v-bind="carouselArgs" />
  </div>
</template>

<style lang="scss">
.embla {
  overflow: hidden;
}
.embla__container {
  display: flex;
}
.embla__slide {
  position: relative;
  flex: 0 0 100%;
}
</style>
