import type { ComputedRef, Ref } from 'vue'
import type { Row } from '~/lib/types'

/**
 * Vertical viewport windowing for the lane/grid calendar views.
 *
 * A dense day can produce hundreds of absolutely-positioned records (the calendar list is fetched
 * with limitOverride=3000), and expanded row-height grows the grid unboundedly — rendering every
 * record lags the tab. This returns only the records whose vertical `[top, top + height]` band
 * intersects the visible scroll region of `scrollContainer` (plus an overscan margin), so the DOM
 * stays small while the layout and scroll range are unchanged.
 *
 * Unlike `UseVirtualList` (which only handles a 1-D uniform-height list), this is layout-agnostic:
 * records keep their absolute grid / lane / multi-day-spanning positions. `top`/`height` are read
 * from `rowMeta.style` (px). The small constant offset between the grid and the scroll container is
 * absorbed by the overscan.
 */
export function useCalendarWindow(
  scrollContainer: Ref<HTMLElement | null | undefined>,
  records: Ref<Row[]>,
  options: {
    overscan?: number
    alwaysInclude?: (record: Row) => boolean
  } = {},
): ComputedRef<Row[]> {
  const { overscan = 800 } = options

  const { y: scrollY } = useScroll(scrollContainer, { throttle: 100 })

  const { height: viewportHeight } = useElementSize(scrollContainer)

  return computed(() => {
    const all = records.value
    if (all.length <= 1) return all

    const vpH = viewportHeight.value || (typeof window !== 'undefined' ? window.innerHeight : 800)
    if (!vpH) return all

    const winTop = scrollY.value - overscan
    const winBottom = scrollY.value + vpH + overscan

    return all.filter((record) => {
      if (options.alwaysInclude?.(record)) return true
      const top = Number.parseFloat(`${record.rowMeta.style?.top ?? 0}`)
      const height = Number.parseFloat(`${record.rowMeta.style?.height ?? 0}`)
      return top + height >= winTop && top <= winBottom
    })
  })
}
