import { InterfacePageLayoutTypes, InterfaceVisualizationTypes } from 'nocodb-sdk'
import type { ColumnType, InterfaceGridVizConfig, InterfacePageType } from 'nocodb-sdk'
import { scopeColumnsToPageVisualization } from '~/ee/utils/interfaceUtils'

/**
 * A button's "Create form" seeds a NEW record form from the page it sits on:
 * only the fields that page's first visualization shows, in its order. These
 * cover the scoping half — `buildDefaultRecordFormConfig` then drops whatever
 * a form cannot accept (computed/auto columns).
 */
const columns = [
  { id: 'c1', title: 'Name', pv: true, uidt: 'SingleLineText' },
  { id: 'c2', title: 'Email', uidt: 'Email' },
  { id: 'c3', title: 'Age', uidt: 'Number' },
  { id: 'c4', title: 'City', uidt: 'SingleLineText' },
] as ColumnType[]

function buildViz(overrides: Partial<InterfaceGridVizConfig> = {}): InterfaceGridVizConfig {
  return { id: 'viz1', type: InterfaceVisualizationTypes.GRID, ...overrides } as InterfaceGridVizConfig
}

function buildPage(vizzes: InterfaceGridVizConfig[], overrides: Partial<InterfacePageType> = {}): InterfacePageType {
  return {
    id: 'pag1',
    fk_interface_id: 'itf1',
    base_id: 'p1',
    title: 'Task Board',
    layout: InterfacePageLayoutTypes.TABLE,
    fk_model_id: 'tbl1',
    config: { visualizations: vizzes },
    ...overrides,
  } as InterfacePageType
}

const scopedIds = (page: InterfacePageType | null, sourceTableId: string | null = 'tbl1') =>
  scopeColumnsToPageVisualization(columns, page, sourceTableId).map((column) => column.id)

describe('scopeColumnsToPageVisualization', () => {
  it('keeps every column when the viz has no field curation', () => {
    expect(scopedIds(buildPage([buildViz()]))).toEqual(['c1', 'c2', 'c3', 'c4'])
  })

  it('narrows to the visible fields, in the curation order', () => {
    expect(scopedIds(buildPage([buildViz({ visible_field_ids: ['c3', 'c1'] })]))).toEqual(['c3', 'c1'])
  })

  it('applies the header drag order when everything is visible', () => {
    expect(scopedIds(buildPage([buildViz({ field_order: ['c4', 'c2'] })]))).toEqual(['c4', 'c2', 'c1', 'c3'])
  })

  it('layers the header drag order on top of the curation', () => {
    const page = buildPage([buildViz({ visible_field_ids: ['c1', 'c2', 'c3'], field_order: ['c3', 'c1', 'c2'] })])

    expect(scopedIds(page)).toEqual(['c3', 'c1', 'c2'])
  })

  it('ignores ids the table no longer has', () => {
    expect(scopedIds(buildPage([buildViz({ visible_field_ids: ['c2', 'gone', 'c4'] })]))).toEqual(['c2', 'c4'])
  })

  it('reads the FIRST visualization on a multi-viz page', () => {
    const page = buildPage([
      buildViz({ id: 'viz1', visible_field_ids: ['c2'] }),
      buildViz({ id: 'viz2', visible_field_ids: ['c3', 'c4'] }),
    ])

    expect(scopedIds(page)).toEqual(['c2'])
  })

  // ── Cases that must NOT scope ─────────────────────────────────────────────

  it('keeps every column when the button targets a different table', () => {
    const page = buildPage([buildViz({ visible_field_ids: ['c2'] })])

    expect(scopedIds(page, 'other-table')).toEqual(['c1', 'c2', 'c3', 'c4'])
  })

  it('keeps every column on a layout that has no visualizations', () => {
    const page = buildPage([buildViz({ visible_field_ids: ['c2'] })], {
      layout: InterfacePageLayoutTypes.RECORD_REVIEW,
    })

    expect(scopedIds(page)).toEqual(['c1', 'c2', 'c3', 'c4'])
  })

  it('keeps every column when the page has no visualization yet', () => {
    expect(scopedIds(buildPage([]))).toEqual(['c1', 'c2', 'c3', 'c4'])
  })

  it('keeps every column rather than producing an empty form', () => {
    // Every curated id has since been deleted from the table.
    expect(scopedIds(buildPage([buildViz({ visible_field_ids: ['gone1', 'gone2'] })]))).toEqual(['c1', 'c2', 'c3', 'c4'])
  })

  it('keeps every column when there is no page', () => {
    expect(scopedIds(null)).toEqual(['c1', 'c2', 'c3', 'c4'])
  })

  it('keeps every column when no curated field would survive the form filter', () => {
    // The page shows ONLY computed fields — possible, since even the display
    // value can be a formula. The curation is non-empty here, but
    // `buildDefaultRecordFormConfig` drops every computed type, so scoping to
    // it would hand the builder a zero-field creation modal.
    const computedOnly = [
      { id: 'f1', title: 'Label', pv: true, uidt: 'Formula' },
      { id: 'f2', title: 'Total', uidt: 'Rollup' },
      { id: 'f3', title: 'Name', uidt: 'SingleLineText' },
    ] as ColumnType[]

    const page = buildPage([buildViz({ visible_field_ids: ['f1', 'f2'] })])

    expect(scopeColumnsToPageVisualization(computedOnly, page, 'tbl1').map((column) => column.id)).toEqual(['f1', 'f2', 'f3'])
  })
})

// `buildDefaultRecordFormConfig` is deliberately not covered here — it preserves
// the order it is handed, which is what the scoping above pins down.
