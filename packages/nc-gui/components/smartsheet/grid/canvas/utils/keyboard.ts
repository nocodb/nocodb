import { useThrottleFn } from '@vueuse/core'

/**
 * Throttles held-down keys only. A dropped single press (e.g. Tab right after typing) skips
 * preventDefault, so the browser acts on it and the editor stays open.
 */
export function throttleHeldKeys<T>(handler: (e: KeyboardEvent) => T, ms: number) {
  const throttled = useThrottleFn(handler, ms)
  return (e: KeyboardEvent) => (e.repeat ? throttled(e) : handler(e))
}
