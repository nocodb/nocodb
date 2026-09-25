<script lang="ts" setup>
/**
 * One active-item pill for the whole rail, gliding to whichever item is active
 * instead of each item fading its own in and out. Place inside the rail's
 * `position: relative` container; the items' own pills are hidden while it is
 * mounted (see `.nc-rail-sliding`).
 */

const PILL_HEIGHT = 22

const pillRef = ref<HTMLElement>()

const offsetY = ref(0)

const isVisible = ref(false)

/** The first placement jumps; only moves after that glide. */
const isPlaced = ref(false)

let mutationObserver: MutationObserver | undefined

let resizeObserver: ResizeObserver | undefined

function container() {
  return pillRef.value?.parentElement ?? null
}

function measure() {
  const root = container()
  if (!root) return

  // Dropdown triggers and plain-active items never showed a pill of their own.
  const active = root.querySelector<HTMLElement>('.nc-rail-item.active:not(.is-dropdown):not(.plain-active)')

  if (!active) {
    isVisible.value = false
    return
  }

  const rootRect = root.getBoundingClientRect()
  const itemRect = active.getBoundingClientRect()

  const pillHeight = pillRef.value?.offsetHeight || PILL_HEIGHT

  offsetY.value = itemRect.top - rootRect.top + root.scrollTop + (itemRect.height - pillHeight) / 2
  isVisible.value = true

  if (!isPlaced.value) requestAnimationFrame(() => (isPlaced.value = true))
}

onMounted(() => {
  const root = container()
  if (!root) return

  root.classList.add('nc-rail-sliding')

  nextTick(measure)

  // Active state is a class the items toggle themselves; items also mount and unmount with permissions.
  mutationObserver = new MutationObserver(() => measure())
  mutationObserver.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] })

  resizeObserver = new ResizeObserver(() => measure())
  resizeObserver.observe(root)
})

onBeforeUnmount(() => {
  container()?.classList.remove('nc-rail-sliding')
  mutationObserver?.disconnect()
  resizeObserver?.disconnect()
})
</script>

<template>
  <span
    ref="pillRef"
    class="nc-rail-indicator"
    :class="{ 'nc-rail-indicator-placed': isPlaced }"
    :style="{ transform: `translateY(${offsetY}px)`, opacity: isVisible ? 1 : 0 }"
    aria-hidden="true"
  />
</template>

<style lang="scss" scoped>
.nc-rail-indicator {
  @apply absolute top-0 left-0 w-[4px] h-[22px] rounded-r-[3px] bg-nc-content-brand pointer-events-none z-1;
  will-change: transform;
}

.nc-rail-indicator-placed {
  transition: transform 280ms cubic-bezier(0.2, 0, 0, 1), opacity 150ms ease;
}

@media (prefers-reduced-motion: reduce) {
  .nc-rail-indicator-placed {
    transition: opacity 150ms ease;
  }
}

@media (pointer: coarse) {
  .nc-rail-indicator {
    @apply h-[24px];
  }
}
</style>

<style lang="scss">
// The rail's own pill replaces the per-item ones.
.nc-rail-sliding .nc-rail-item .nc-rail-item-indicator {
  display: none;
}

.rtl .nc-rail-indicator {
  left: auto;
  right: 0;
  border-radius: 2px 0 0 2px;
}
</style>
