<script lang="ts" setup>
import { onBeforeUnmount, onMounted, watch } from '#imports'

type FlipTrigger = 'hover' | 'click' | { duration: number }

interface Props {
  triggers?: FlipTrigger[]
  duration?: number
}

const props = withDefaults(defineProps<Props>(), {
  triggers: () => ['click'] as FlipTrigger[],
  duration: 800,
})

const flipped = ref(false)

const hovered = ref(false)

const flipTimer = ref<NodeJS.Timer | null>(null)

onMounted(() => {
  const duration = props.triggers.reduce((dur, trigger) => {
    if (typeof trigger !== 'string') {
      dur = trigger.duration
    }

    return dur
  }, 0)

  if (duration > 0) {
    flipTimer.value = setInterval(() => {
      if (!hovered.value) {
        flipped.value = !flipped.value
      }
    }, duration)
  }
})

onBeforeUnmount(() => {
  if (flipTimer.value) {
    clearInterval(flipTimer.value)
  }
})

function onHover(isHovering: boolean) {
  hovered.value = isHovering

  if (props.triggers.find((trigger) => trigger === 'hover')) {
    flipped.value = isHovering
  }
}

function onClick() {
  if (props.triggers.find((trigger) => trigger === 'click')) {
    flipped.value = !flipped.value
  }
}

const isFlipping = ref(false)

watch(flipped, () => {
  isFlipping.value = true

  setTimeout(() => {
    isFlipping.value = false
  }, props.duration / 2)
})
</script>

<template>
  <div class="flip-card" @click="onClick" @mouseover="onHover(true)" @mouseleave="onHover(false)">
    <div
      class="flipper"
      :style="{ '--flip-duration': `${props.duration || 800}ms`, 'transform': flipped ? 'rotateY(180deg)' : '' }"
    >
      <div
        class="front"
        :style="{ 'pointer-events': flipped ? 'none' : 'auto', 'opacity': !isFlipping ? (flipped ? 0 : 100) : flipped ? 100 : 0 }"
      >
        <slot name="front" />
      </div>

      <div
        class="back"
        :style="{ 'pointer-events': flipped ? 'auto' : 'none', 'opacity': !isFlipping ? (flipped ? 100 : 0) : flipped ? 0 : 100 }"
      >
        <slot name="back" />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.flip-card {
  background-color: transparent;
  perspective: 1000px;
}

.flipper {
  --flip-duration: 800ms;

  position: relative;
  width: 100%;
  height: 100%;
  text-align: center;
  transition: all ease-in-out;
  transition-duration: var(--flip-duration);
  transform-style: preserve-3d;
}

.front,
.back {
  position: absolute;
  width: 100%;
  height: 100%;
  -webkit-backface-visibility: hidden;
  backface-visibility: hidden;
}

.back {
  transform: rotateY(180deg);
}
</style>
