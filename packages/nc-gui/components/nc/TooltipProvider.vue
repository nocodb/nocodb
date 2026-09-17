<script lang="ts" setup>
import type { NcTooltipGroup } from '~/lib/types'

/**
 * NcTooltipProvider
 *
 * Groups the NcTooltips below it under one open delay, the way Base UI's Tooltip.Provider
 * does: the first tooltip waits `delay`, and while one is open, or for `timeout` ms after
 * one closed, the neighbours open instantly. Renders nothing of its own.
 *
 * @example
 * ```vue
 * <NcTooltipProvider :delay="200">
 *   <NcTooltip title="Bold"><button>B</button></NcTooltip>
 *   <NcTooltip title="Italic"><button>I</button></NcTooltip>
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
}

const props = withDefaults(defineProps<Props>(), {
  timeout: 400,
})

let openCount = 0

let lastClosedAt = -Infinity

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
}

provide(TooltipProviderInj, group)
</script>

<template>
  <slot />
</template>
