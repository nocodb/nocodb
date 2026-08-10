<script setup lang="ts">
import type { NcTour } from '../../tours'
import { resolveTourAnchor, resolveTourText } from '../../tours'

interface Props {
  tour: NcTour
  anchor: string
}

const props = defineProps<Props>()

const { start, isActive } = useTours()

/** Cheap — one querySelector per beacon. */
const POLL_MS = 500

const rect = ref<{ top: number; left: number }>()

/**
 * Re-resolved on a timer rather than held as a ref: the anchor mounts and unmounts
 * with navigation, and a stale element leaves the beacon floating over nothing.
 */
function reposition() {
  // While a tour runs driver.js owns the screen.
  if (isActive.value) {
    rect.value = undefined
    return
  }

  const el = resolveTourAnchor(props.anchor)

  if (!el) {
    rect.value = undefined
    return
  }

  const box = el.getBoundingClientRect()

  // Zero-sized = not laid out; off-viewport = scrolled away.
  const isVisible =
    box.width > 0 &&
    box.height > 0 &&
    box.bottom > 0 &&
    box.right > 0 &&
    box.top < window.innerHeight &&
    box.left < window.innerWidth

  rect.value = isVisible ? { top: box.top - 3, left: box.right - 7 } : undefined
}

function onClick() {
  start(props.tour.id, 'beacon')
}

useIntervalFn(reposition, POLL_MS, { immediate: true, immediateCallback: true })

/**
 * Coalesce to one measurement per frame. The scroll listener is capture-phase so
 * it sees every scrollable container in the app, and `reposition` reads layout —
 * running it per event would force a sync reflow on every scroll tick.
 */
let queued = false

function repositionOnFrame() {
  if (queued) return

  queued = true

  requestAnimationFrame(() => {
    queued = false
    reposition()
  })
}

// The timer alone would lag behind a scroll or resize.
useEventListener(window, 'scroll', repositionOnFrame, { passive: true, capture: true })
useEventListener(window, 'resize', repositionOnFrame)

watch(isActive, reposition)

onMounted(reposition)
</script>

<template>
  <div
    v-if="rect"
    class="nc-tour-beacon"
    :style="{ top: `${rect.top}px`, left: `${rect.left}px` }"
    :data-testid="`nc-tour-beacon-${tour.id}`"
    @click.stop="onClick"
  >
    <NcTooltip :title="$t('tooltip.tourTakeTheTour', { tour: resolveTourText(tour.title) })" placement="right">
      <div class="nc-tour-beacon-dot pulsing-dot" />
    </NcTooltip>
  </div>
</template>

<style scoped lang="scss">
@keyframes pulse {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.7;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.nc-tour-beacon {
  @apply fixed cursor-pointer;

  // Below the 1050 dropdowns/modals, so a beacon can't float over a dialog.
  z-index: 1000;
}

.nc-tour-beacon-dot {
  @apply w-2.5 h-2.5 bg-nc-fill-primary border-2 border-white rounded-full;
}

.pulsing-dot {
  animation: pulse 1.5s infinite ease-in-out;
}
</style>
