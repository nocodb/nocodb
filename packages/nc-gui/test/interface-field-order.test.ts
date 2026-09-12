import { InterfaceVisualizationTypes, applyFieldOrder, orderVizFieldIds } from 'nocodb-sdk'
import type { InterfaceGalleryVizConfig } from 'nocodb-sdk'

/**
 * `applyFieldOrder` is the single ordering primitive behind the builder's Fields
 * pane. Three callers share it and must not drift:
 * - `buildInterfaceSyntheticMeta` (via `orderVizFieldIds`) → rendered column order
 * - `interfaceTableDataExport` (via `orderVizFieldIds`)     → CSV column order
 * - the leveled-list hydration projection                   → parent-level order
 *
 * Deliberately DOM-free so it runs without the Nuxt/canvas harness the
 * `buildInterfaceSyntheticMeta` suites need.
 */
describe('applyFieldOrder', () => {
  it('passes ids through untouched when no order is persisted', () => {
    expect(applyFieldOrder(undefined, ['c1', 'c2', 'c3'])).toEqual(['c1', 'c2', 'c3'])
    expect(applyFieldOrder([], ['c1', 'c2', 'c3'])).toEqual(['c1', 'c2', 'c3'])
    expect(applyFieldOrder(null, ['c1', 'c2', 'c3'])).toEqual(['c1', 'c2', 'c3'])
  })

  it('puts listed ids first, in the persisted order', () => {
    expect(applyFieldOrder(['c3', 'c1', 'c2'], ['c1', 'c2', 'c3'])).toEqual(['c3', 'c1', 'c2'])
  })

  it('appends unlisted ids after, in the order they came in', () => {
    // A column added to the table after the drag — it must not vanish.
    expect(applyFieldOrder(['c3', 'c1'], ['c1', 'c2', 'c3', 'c4'])).toEqual(['c3', 'c1', 'c2', 'c4'])
  })

  it('drops order entries for ids the caller did not offer', () => {
    // The caller's list is the authority on what exists — a deleted column, or
    // one curated out by `visible_field_ids`, can never be revived by the order.
    expect(applyFieldOrder(['gone', 'c2', 'c1'], ['c1', 'c2'])).toEqual(['c2', 'c1'])
  })

  it('never widens the set — output is always a permutation of the input', () => {
    const ids = ['c1', 'c2', 'c3']
    const out = applyFieldOrder(['c4', 'c5', 'c3'], ids)

    expect([...out].sort()).toEqual([...ids].sort())
  })

  it('skips falsy ids', () => {
    expect(applyFieldOrder(['c2'], ['c1', undefined, 'c2'])).toEqual(['c2', 'c1'])
  })
})

describe('orderVizFieldIds', () => {
  /**
   * The pane writes `field_order` for EVERY viz type, not just grid — this is
   * the shared read-back the non-grid renderers depend on.
   */
  it('reads the order off a non-grid viz config', () => {
    const viz = {
      id: 'viz1',
      type: InterfaceVisualizationTypes.GALLERY,
      field_order: ['c3', 'c1'],
    } as InterfaceGalleryVizConfig

    expect(orderVizFieldIds(viz, ['c1', 'c2', 'c3'])).toEqual(['c3', 'c1', 'c2'])
  })

  it('falls back to the given order when the viz carries none', () => {
    const viz = { id: 'viz1', type: InterfaceVisualizationTypes.GALLERY } as InterfaceGalleryVizConfig

    expect(orderVizFieldIds(viz, ['c1', 'c2'])).toEqual(['c1', 'c2'])
  })
})
