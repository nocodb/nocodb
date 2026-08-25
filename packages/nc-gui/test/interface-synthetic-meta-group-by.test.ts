import { InterfaceVisualizationTypes } from 'nocodb-sdk'
import type { ColumnType, InterfaceTimelineVizConfig, TableType } from 'nocodb-sdk'
import { buildInterfaceSyntheticMeta } from '~/ee/utils/interfaceViewUtils'

/**
 * The canvas stamps grouping onto the synthetic meta, which is what feeds
 * `gridViewCols` → `useViewGroupBy`. It passes the SERVER-ACKNOWLEDGED grouping,
 * not the live draft: the data ops validate a group-by request against the saved
 * viz config, so grouping off the draft 403s inside the debounced-persist window.
 */
const columns = [
  { id: 'c1', title: 'Name', pv: true, uidt: 'SingleLineText' },
  { id: 'c2', title: 'Status', uidt: 'SingleLineText' },
  { id: 'c3', title: 'Start', uidt: 'Date' },
] as ColumnType[]

const tableMeta = { id: 'tbl1', source_id: 's1', columns } as unknown as TableType

function buildTimelineViz(groupBy?: InterfaceTimelineVizConfig['group_by']): InterfaceTimelineVizConfig {
  return {
    id: 'viz1',
    type: InterfaceVisualizationTypes.TIMELINE,
    date_ranges: [{ start_field_id: 'c3' }],
    ...(groupBy ? { group_by: groupBy } : {}),
  } as InterfaceTimelineVizConfig
}

/** Column ids the meta marks as grouping columns, in nesting order. */
function groupedIds(viz: InterfaceTimelineVizConfig, override?: Parameters<typeof buildInterfaceSyntheticMeta>[2]) {
  return (buildInterfaceSyntheticMeta(tableMeta, viz, override).columns as ColumnType[])
    .filter((col) => (col as { group_by?: boolean }).group_by)
    .sort(
      (a, b) =>
        ((a as { group_by_order?: number }).group_by_order ?? 0) - ((b as { group_by_order?: number }).group_by_order ?? 0),
    )
    .map((col) => col.id)
}

describe('buildInterfaceSyntheticMeta — group_by', () => {
  it('stamps the viz own group_by when no override is given', () => {
    expect(groupedIds(buildTimelineViz([{ fk_column_id: 'c2' }]))).toEqual(['c2'])
  })

  it('stamps the override instead of the viz group_by', () => {
    expect(groupedIds(buildTimelineViz([{ fk_column_id: 'c1' }]), [{ fk_column_id: 'c2' }])).toEqual(['c2'])
  })

  it('treats a null override as no grouping, even when the viz carries one', () => {
    expect(groupedIds(buildTimelineViz([{ fk_column_id: 'c2' }]), null)).toEqual([])
  })

  it('treats an empty override as no grouping', () => {
    expect(groupedIds(buildTimelineViz([{ fk_column_id: 'c2' }]), [])).toEqual([])
  })

  it('carries the group direction through the override', () => {
    const meta = buildInterfaceSyntheticMeta(tableMeta, buildTimelineViz(), [{ fk_column_id: 'c2', direction: 'desc' }])
    const grouped = (meta.columns as ColumnType[]).find((col) => col.id === 'c2') as { group_by_sort?: string }

    expect(grouped.group_by_sort).toBe('desc')
  })
})
