<script lang="ts" setup>
import type { NcTooltipGroup } from '~/lib/types'

/**
 * NcTooltipProvider
 *
 * Groups the NcTooltips below it under one open delay, the way Base UI's Tooltip.Provider
 * does: the first tooltip waits `delay`, and while one is open, or for `timeout` ms after
 * one closed, the neighbours open instantly.
 *
 * With `glide`, it also owns a single popup that MOVES between its items instead of one
 * being destroyed and the next created. That is the only way to animate between triggers —
 * two popups that never coexist cannot transition into each other. Only `NcTooltipItem`
 * opts into it; a plain `NcTooltip` inside a glide provider still renders its own
 * `a-tooltip`, unchanged.
 *
 * @example
 * ```vue
 * <NcTooltipProvider :delay="200">
 *   <NcTooltip title="Bold"><button>B</button></NcTooltip>
 *   <NcTooltip title="Italic"><button>I</button></NcTooltip>
 * </NcTooltipProvider>
 *
 * <NcTooltipProvider glide :delay="200">
 *   <NcTooltipItem title="GitHub"><GithubIcon /></NcTooltipItem>
 *   <NcTooltipItem title="GitLab"><GitlabIcon /></NcTooltipItem>
 * </NcTooltipProvider>
 * ```
 */
interface Props {
  /** Milliseconds before a cold open. Each tooltip's own `mouseEnterDelay` when omitted. */
  delay?: number
  /** Milliseconds before closing. */
  closeDelay?: number
  /** Milliseconds after a close during which the next tooltip in the group opens instantly. */
  timeout?: number
  /** Own one popup that slides between `NcTooltipItem`s rather than one popup each. */
  glide?: boolean
  /** Which side of the anchor the shared popup sits on. */
  placement?: 'top' | 'bottom'
}

const props = withDefaults(defineProps<Props>(), {
  timeout: 400,
  glide: false,
  placement: 'top',
})

/** Gap between the anchor and the popup, in px. */
const ANCHOR_OFFSET = 8

/**
 * How long the popup survives a leave before closing, in ms.
 *
 * Long enough for the pointer to cross the gap between two neighbours, so the
 * next `show` cancels it and the popup moves instead of blinking.
 */
const HANDOFF_GRACE = 120

let openCount = 0

let lastClosedAt = -Infinity

// ── Shared popup (glide only) ──

const activeAnchor = ref<HTMLElement>()

const title = ref('')

/**
 * Holds the current title at its natural width, out of flow and invisible.
 *
 * Measuring the visible label instead would read back the width already pinned
 * on it, and during a cross-fade there are briefly two of them.
 */
const measureRef = ref<HTMLElement>()

const width = ref(0)

const position = ref({ x: 0, y: 0 })

const isOpen = computed(() => !!activeAnchor.value)

/**
 * Only the second and later opens glide; the first has nowhere to come from, so
 * it fades in place rather than sliding in from the last position.
 */
const hasMoved = ref(false)

const popupStyle = computed(() => ({
  left: `${position.value.x}px`,
  top: `${position.value.y}px`,
}))

const labelStyle = computed(() => (width.value ? { width: `${width.value}px` } : {}))

function place(anchor: HTMLElement) {
  const rect = anchor.getBoundingClientRect()

  position.value = {
    x: rect.left + rect.width / 2,
    y: props.placement === 'top' ? rect.top - ANCHOR_OFFSET : rect.bottom + ANCHOR_OFFSET,
  }
}

async function measure() {
  await nextTick()

  // `width: auto` cannot be transitioned, so the label is pinned to the number
  // it needs. It goes on the label rather than the popup because the popup is
  // `border-box` — pinning it there would let the padding eat into the text.
  if (measureRef.value) width.value = measureRef.value.offsetWidth
}

let closeTimer: ReturnType<typeof setTimeout> | undefined

function show(anchor: HTMLElement, text: string) {
  // Cancels the close the item we just left scheduled, which is what carries one
  // popup across the gap instead of unmounting and remounting it.
  clearTimeout(closeTimer)

  hasMoved.value = isOpen.value
  activeAnchor.value = anchor
  title.value = text

  place(anchor)
  measure()
}

function close() {
  clearTimeout(closeTimer)
  activeAnchor.value = undefined
  hasMoved.value = false
}

function hide(anchor: HTMLElement) {
  // A later item already took over — its `show` is the truth, not this leave.
  if (activeAnchor.value !== anchor) return

  // Deferred: leaving one item fires before entering the next, so closing here
  // would blink the popup out between every pair.
  clearTimeout(closeTimer)
  closeTimer = setTimeout(() => {
    if (activeAnchor.value === anchor) close()
  }, HANDOFF_GRACE)
}

const group: NcTooltipGroup = {
  get delay() {
    return props.delay
  },
  get closeDelay() {
    return props.closeDelay
  },
  get timeout() {
    return props.timeout
  },
  enterDelay(own) {
    const warm = openCount > 0 || Date.now() - lastClosedAt < props.timeout
    return warm ? 0 : props.delay ?? own
  },
  onOpen() {
    openCount++
  },
  onClose() {
    openCount = Math.max(0, openCount - 1)
    lastClosedAt = Date.now()
  },
  glide: props.glide ? { show, hide } : undefined,
}

provide(TooltipProviderInj, group)

// The popup is fixed to the viewport, so anything that moves the anchor under it
// has to close it — re-placing on every scroll frame would fight the transition.
useEventListener(window, 'scroll', close, true)

onBeforeUnmount(() => clearTimeout(closeTimer))
</script>

<template>
  <slot />

  <Teleport v-if="glide" to="body">
    <Transition name="nc-tooltip-glide-fade">
      <div
        v-if="isOpen"
        class="nc-tooltip-glide"
        :class="{ 'nc-tooltip-glide-moving': hasMoved, 'nc-tooltip-glide-below': placement === 'bottom' }"
        :style="popupStyle"
        role="tooltip"
      >
        <span ref="measureRef" class="nc-tooltip-glide-measure" aria-hidden="true">{{ title }}</span>

        <TransitionGroup name="nc-tooltip-glide-label" tag="span" class="nc-tooltip-glide-label" :style="labelStyle">
          <span :key="title">{{ title }}</span>
        </TransitionGroup>
      </div>
    </Transition>
  </Teleport>
</template>

<style lang="scss">
.nc-tooltip-glide {
  @apply fixed z-1080 px-2 py-1 rounded-lg bg-gray-800 text-white text-bodySm whitespace-nowrap pointer-events-none;

  // Centred on the anchor and sitting above it; `top` is the anchor's edge.
  transform: translate(-50%, -100%);
}

// The popup is centred on its anchor, so a centred arrow points at it whatever
// the label's width. A pseudo-element rather than a node: it only has to ride
// along with the popup, never animate on its own.
.nc-tooltip-glide::after {
  content: '';

  @apply absolute left-1/2 h-2 w-2 rounded-sm bg-gray-800;

  bottom: -3px;
  transform: translateX(-50%) rotate(45deg);
}

// Out of flow, so it never contributes to the popup's own size.
.nc-tooltip-glide-measure {
  @apply absolute invisible pointer-events-none whitespace-nowrap;
}

.nc-tooltip-glide-below {
  transform: translate(-50%, 0);

  &::after {
    bottom: auto;
    top: -3px;
  }
}

// Only once a second item has taken over — see `hasMoved`.
.nc-tooltip-glide-moving {
  transition-property: left, top;
  transition-duration: 180ms;
  transition-timing-function: cubic-bezier(0.2, 0, 0, 1);

  // The popup's own width stays `auto` and follows the label, so the padding is
  // never squeezed.
  .nc-tooltip-glide-label {
    transition: width 180ms cubic-bezier(0.2, 0, 0, 1);
  }
}

[theme='dark'] .nc-tooltip-glide,
[theme='dark'] .nc-tooltip-glide::after {
  background-color: var(--nc-bg-tooltip);
}

.nc-tooltip-glide-label {
  @apply relative block overflow-hidden;

  > span {
    @apply block transition-opacity duration-150;
  }
}

.nc-tooltip-glide-label-enter-from,
.nc-tooltip-glide-label-leave-to {
  @apply opacity-0;
}

// Only the outgoing label leaves the flow, so the incoming one always holds the
// popup's height. Both out of flow would collapse it to its padding mid-swap.
.nc-tooltip-glide-label-leave-active {
  @apply absolute top-0 left-0;
}

.nc-tooltip-glide-fade-enter-active,
.nc-tooltip-glide-fade-leave-active {
  @apply transition-opacity duration-150;
}

.nc-tooltip-glide-fade-enter-from,
.nc-tooltip-glide-fade-leave-to {
  @apply opacity-0;
}

@media (prefers-reduced-motion: reduce) {
  .nc-tooltip-glide-moving {
    transition-duration: 0ms;
  }
}
</style>
