import { describe, expect, it } from 'vitest'
import { bisectSidebarOrder } from '../ee/utils/sidebarOrderUtils'

/**
 * `bisectSidebarOrder` decides whether a sidebar drag can persist as a single
 * midpoint write or must renormalise the whole container (Data sidebar:
 * section headers interleaved with tables / dashboards / root docs, which
 * each carry their own order sequence — duplicate and zero orders are common
 * on legacy / bulk / sync-created bases).
 */
describe('bisectSidebarOrder', () => {
  it('places between distinct neighbours at their midpoint', () => {
    expect(bisectSidebarOrder(1, 2)).toEqual({ order: 1.5, placeable: true })
  })

  it('places into an empty container at order 1', () => {
    expect(bisectSidebarOrder(null, null)).toEqual({ order: 1, placeable: true })
  })

  it('places after the last row at before + 1', () => {
    expect(bisectSidebarOrder(3, null)).toEqual({ order: 4, placeable: true })
  })

  it('places before the first row at after / 2', () => {
    expect(bisectSidebarOrder(null, 4)).toEqual({ order: 2, placeable: true })
  })

  it('flags equal neighbour orders as not placeable (all-order-1 legacy base)', () => {
    // The midpoint equals both neighbours — persisting it silently reverts on
    // reload, exactly the repro behind the sidebar reorder collision fix.
    expect(bisectSidebarOrder(1, 1).placeable).toBe(false)
  })

  it('flags a zero first-row order as not placeable at the top edge', () => {
    // after / 2 === 0 === after — no room above a row with order 0.
    expect(bisectSidebarOrder(null, 0).placeable).toBe(false)
  })

  it('flags inverted neighbour orders as not placeable', () => {
    // Mixed per-type sequences can put a higher order above a lower one.
    expect(bisectSidebarOrder(5, 2).placeable).toBe(false)
  })
})
