<script setup lang="ts">
const store = useTooltipStore()
const { tooltip, containerSize } = storeToRefs(store)
const tooltipRef = ref<HTMLElement | null>(null)

const { width: tooltipWidth } = useElementBounding(tooltipRef)

const vw = ref(window.innerWidth)
const vh = ref(window.innerHeight)

onMounted(() => {
  const updateViewport = () => {
    vw.value = window.innerWidth
    vh.value = window.innerHeight
  }
  window.addEventListener('resize', updateViewport)
  onUnmounted(() => window.removeEventListener('resize', updateViewport))
})

const tooltipPosition = computed(() => {
  if (!tooltip.value) return { x: 0, y: 0 }

  const baseX = vw.value - containerSize.value.width + tooltip.value.position.x
  const baseY = vh.value - containerSize.value.height + tooltip.value.position.y - 50

  const wouldOverflowRight = baseX + tooltipWidth.value / 2 > vw.value
  const wouldOverflowLeft = baseX - tooltipWidth.value / 2 < 0
  const wouldOverflowTop = baseY < 0

  let x = baseX
  let y = baseY
  let transform = 'translateX(-50%)'

  if (wouldOverflowRight) {
    x = vw.value - 8
    transform = 'translateX(-100%)'
  } else if (wouldOverflowLeft) {
    x = 8
    transform = 'translateX(0)'
  }

  if (wouldOverflowTop) {
    y = vh.value - containerSize.value.height + tooltip.value.position.y + 50
  }

  return { x, y, transform }
})

const tooltipStyle = computed(() => {
  if (!tooltip.value) return {}

  const { x, y, transform } = tooltipPosition.value

  return {
    position: 'fixed',
    left: `${x}px`,
    top: `${y}px`,
    transform,
  }
})

const tooltipClass = computed(() => {
  const theme = tooltip.value?.theme || 'dark'
  return ['tooltip', `tooltip-${theme}`, !tooltip.value && 'hidden']
})
</script>

<template>
  <Teleport to="body">
    <Transition name="tooltip">
      <div v-if="tooltip" ref="tooltipRef" :class="tooltipClass" :style="tooltipStyle">
        {{ tooltip.text }}
      </div>
    </Transition>
  </Teleport>
</template>

<style lang="scss">
.tooltip {
  @apply pointer-events-none px-2 py-1 rounded-lg text-sm whitespace-pre-line;
  z-index: 1000;
}

.tooltip.hidden {
  @apply invisible;
}

.tooltip-dark {
  @apply bg-gray-800 text-white;
}

.tooltip-light {
  @apply bg-gray-200 text-gray-800;
}

.tooltip-enter-active,
.tooltip-leave-active {
  @apply transition-opacity duration-150 ease-in-out;
}

.tooltip-enter-from,
.tooltip-leave-to {
  @apply opacity-0;
}
</style>
