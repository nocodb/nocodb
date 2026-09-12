import { InterfaceVisualizationTypes } from 'nocodb-sdk'
import type { ColumnType, InterfaceGridVizConfig, TableType } from 'nocodb-sdk'
import { buildInterfaceSyntheticMeta } from '~/ee/utils/interfaceViewUtils'

/**
 * The grid's own header drag / resize persist into the VIZ config (`field_order`
 * / `field_configs[id].width`) — never into the source table's grid views. These
 * cover the read-back half: the synthetic meta is what feeds `gridViewCols`,
 * where every renderer reads column order and width from.
 */
const columns = [
  { id: 'c1', title: 'Name', pv: true, uidt: 'SingleLineText' },
  { id: 'c2', title: 'Email', uidt: 'Email' },
  { id: 'c3', title: 'Age', uidt: 'Number' },
  { id: 'c4', title: 'City', uidt: 'SingleLineText' },
] as ColumnType[]

const tableMeta = { id: 'tbl1', source_id: 's1', columns } as unknown as TableType

function buildGridViz(overrides: Partial<InterfaceGridVizConfig> = {}): InterfaceGridVizConfig {
  return {
    id: 'viz1',
    type: InterfaceVisualizationTypes.GRID,
    ...overrides,
  } as InterfaceGridVizConfig
}

/** Ids in rendered order, i.e. what the `order` stamp resolves to. */
function renderedIds(viz: InterfaceGridVizConfig) {
  return (buildInterfaceSyntheticMeta(tableMeta, viz).columns as ColumnType[]).map((col) => col.id)
}

describe('buildInterfaceSyntheticMeta — grid field_order', () => {
  it('falls back to table order when no drag has been persisted', () => {
    expect(renderedIds(buildGridViz())).toEqual(['c1', 'c2', 'c3', 'c4'])
  })

  it('renders the persisted drag order', () => {
    expect(renderedIds(buildGridViz({ field_order: ['c1', 'c4', 'c2', 'c3'] }))).toEqual(['c1', 'c4', 'c2', 'c3'])
  })

  it('appends columns the order does not mention (a field added after the drag)', () => {
    expect(renderedIds(buildGridViz({ field_order: ['c3', 'c1'] }))).toEqual(['c3', 'c1', 'c2', 'c4'])
  })

  it('ignores ids of columns that no longer exist', () => {
    expect(renderedIds(buildGridViz({ field_order: ['c4', 'gone', 'c1'] }))).toEqual(['c4', 'c1', 'c2', 'c3'])
  })

  it('rides on top of the visible_field_ids curation without reviving a curated-out column', () => {
    const viz = buildGridViz({ visible_field_ids: ['c1', 'c2', 'c3'], field_order: ['c3', 'c2', 'c1'] })
    const cols = buildInterfaceSyntheticMeta(tableMeta, viz).columns as ColumnType[]

    // c4 was curated out, so it never reaches the meta at all.
    expect(cols.map((col) => col.id)).toEqual(['c3', 'c2', 'c1'])
    expect(cols.every((col) => col.show)).toBe(true)
  })

  it('does not resurrect a curated-out column that the order still mentions', () => {
    const viz = buildGridViz({ visible_field_ids: ['c1', 'c2'], field_order: ['c4', 'c2', 'c1'] })

    expect((buildInterfaceSyntheticMeta(tableMeta, viz).columns as ColumnType[]).map((col) => col.id)).toEqual(['c2', 'c1'])
  })

  it('stamps a sequential order so the drag target lands between its new neighbours', () => {
    const cols = buildInterfaceSyntheticMeta(tableMeta, buildGridViz({ field_order: ['c2', 'c1', 'c3', 'c4'] }))
      .columns as ColumnType[]

    expect(cols.map((col) => (col as { order?: number }).order)).toEqual([1, 2, 3, 4])
  })
})

describe('buildInterfaceSyntheticMeta — grid field width', () => {
  it('stamps the persisted width onto the column the renderers read', () => {
    const viz = buildGridViz({ field_configs: { c2: { width: '320px' } } })
    const cols = buildInterfaceSyntheticMeta(tableMeta, viz).columns as ColumnType[]

    expect((cols.find((col) => col.id === 'c2') as { width?: string }).width).toBe('320px')
    // Untouched columns carry no width — the renderer default applies.
    expect((cols.find((col) => col.id === 'c3') as { width?: string }).width).toBeUndefined()
  })

  it('keeps the width when the column is also reordered', () => {
    const viz = buildGridViz({ field_order: ['c3', 'c1', 'c2', 'c4'], field_configs: { c3: { width: '90px' } } })
    const cols = buildInterfaceSyntheticMeta(tableMeta, viz).columns as ColumnType[]

    expect(cols[0]?.id).toBe('c3')
    expect((cols[0] as { width?: string }).width).toBe('90px')
  })
})
