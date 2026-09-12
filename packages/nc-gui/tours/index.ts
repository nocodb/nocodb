import { useEventBus } from '@vueuse/core'
import { EventBusEnum } from '../lib/enums'
import type { NcTour, TourText } from './types'

export * from './types'

const SELECTOR_PREFIX = 'selector:'

/**
 * Tour copy is `string | (() => string)` so definitions can defer to `t()`. Call
 * this everywhere copy is rendered — never read `.title` directly, or a translated
 * tour shows up as "() => t(...)".
 */
export function resolveTourText(value: TourText): string {
  return typeof value === 'function' ? value() : value
}

/** `'create-base'` -> `[data-tour="create-base"]`, `'selector:.foo'` -> `.foo`. */
export function tourAnchorSelector(anchor: string): string {
  const value = anchor.trim()

  return value.startsWith(SELECTOR_PREFIX) ? value.slice(SELECTOR_PREFIX.length) : `[data-tour="${value}"]`
}

/** The element an anchor currently points at, or null. */
export function resolveTourAnchor(anchor: string): Element | null {
  try {
    return document.querySelector(tourAnchorSelector(anchor))
  } catch {
    // A malformed selector in a tour definition must not break the app.
    console.error(`[tours] invalid anchor selector: ${anchor}`)
    return null
  }
}

export function useTourEventBus() {
  return useEventBus<string>(EventBusEnum.Tour)
}

/** Announce something a tour may react to, from code that needn't know tours exist. */
export function emitTourEvent(name: string) {
  useTourEventBus().emit(name)
}

export type TourModuleMap = Record<string, { default?: NcTour } | undefined>

/**
 * Validate and order `import.meta.glob` results, newest first.
 *
 * The globs stay in `composables/useTourRegistry.ts` and its EE override: they
 * resolve relative to the file they are written in, and only `composables/` is
 * Nuxt-layer aware. Moving them here would leak EE tour copy into the CE bundle.
 */
export function collectTours(...maps: TourModuleMap[]): NcTour[] {
  const byId = new Map<string, { tour: NcTour; path: string }>()

  for (const map of maps) {
    for (const [path, mod] of Object.entries(map)) {
      const tour = mod?.default

      if (!tour?.id) {
        console.error(`[tours] ${path} has no default export from defineTour() — skipped`)
        continue
      }

      const clash = byId.get(tour.id)

      // Ids key persisted seen-state, so a duplicate would merge two tours' history.
      if (clash) throw new Error(`[tours] duplicate tour id "${tour.id}" in ${path} and ${clash.path}`)

      byId.set(tour.id, { tour, path })
    }
  }

  return Array.from(byId.values())
    .map(({ tour }) => tour)
    .sort((a, b) => b.releasedAt.localeCompare(a.releasedAt))
}
