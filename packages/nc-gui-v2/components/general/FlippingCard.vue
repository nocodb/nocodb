<script lang="ts" setup>
type FlipTrigger = 'hover' | 'click' | { duration: number }

interface Props {
  triggers?: FlipTrigger[]
}

const props = withDefaults(defineProps<Props>(), {
  triggers: () => ['click'] as FlipTrigger[],
})

let flipped = $ref(false)
let hovered = $ref(false)
let flipTimer = $ref<NodeJS.Timer | null>(null)

onMounted(() => {
  const duration = props.triggers.reduce((dur, trigger) => {
    if (typeof trigger !== 'string') {
      dur = trigger.duration
    }

    return dur
  }, 0)

  if (duration > 0) {
    flipTimer = setInterval(() => {
      if (!hovered) {
        flipped = !flipped
      }
    }, duration)
  }
})

onBeforeUnmount(() => {
  if (flipTimer) {
    clearInterval(flipTimer)
  }
})

function onHover(isHovering: boolean) {
  hovered = isHovering

  if (props.triggers.find((trigger) => trigger === 'hover')) {
    flipped = isHovering
  }
}

function onClick() {
  if (props.triggers.find((trigger) => trigger === 'click')) {
    flipped = !flipped
  }
}
</script>

<template>
  <div class="flip-card" @click="onClick" @mouseover="onHover(true)" @mouseleave="onHover(false)">
    <div class="flipper" :style="{ transform: flipped ? 'rotateY(180deg)' : '' }">
      <div class="front" :style="{ 'pointer-events': flipped ? 'none' : 'auto' }">
        <slot name="front" />
      </div>
      <div class="back" :style="{ 'pointer-events': flipped ? 'auto' : 'none' }">
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
  position: relative;
  width: 100%;
  height: 100%;
  text-align: center;
  transition: transform 0.8s;
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
