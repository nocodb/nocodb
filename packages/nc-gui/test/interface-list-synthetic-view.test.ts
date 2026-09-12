import { InterfaceVisualizationTypes } from 'nocodb-sdk'
import type { InterfaceListVizConfig, InterfacePageType, ListType, TableType } from 'nocodb-sdk'
import { buildInterfaceSyntheticView } from '~/ee/utils/interfaceViewUtils'

const page = {
  id: 'pg1',
  title: 'List page',
  fk_model_id: 'tbl1',
  base_id: 'b1',
  fk_workspace_id: 'w1',
} as InterfacePageType

const tableMeta = { id: 'tbl1', source_id: 's1', columns: [] } as unknown as TableType

function buildListViz(overrides: Partial<InterfaceListVizConfig> = {}): InterfaceListVizConfig {
  return {
    id: 'viz1',
    type: InterfaceVisualizationTypes.LIST,
    ...overrides,
  } as InterfaceListVizConfig
}

describe('buildInterfaceSyntheticView — LIST row_height', () => {
  it('maps the persisted appearance preset onto the numeric ListType enum the canvas reads', () => {
    // canvas rowHeight computed indexes INTERFACE_ROW_HEIGHTS[view.view.row_height as 0|1|2|3]
    expect(
      (buildInterfaceSyntheticView(page, buildListViz({ row_height: 'small' }), tableMeta).view as ListType).row_height,
    ).toBe(0)
    expect(
      (buildInterfaceSyntheticView(page, buildListViz({ row_height: 'medium' }), tableMeta).view as ListType).row_height,
    ).toBe(1)
    expect(
      (buildInterfaceSyntheticView(page, buildListViz({ row_height: 'large' }), tableMeta).view as ListType).row_height,
    ).toBe(2)
    expect(
      (buildInterfaceSyntheticView(page, buildListViz({ row_height: 'extra_large' }), tableMeta).view as ListType).row_height,
    ).toBe(3)
  })

  it('leaves row_height unset when the config has no preset (canvas falls back to Short)', () => {
    expect((buildInterfaceSyntheticView(page, buildListViz(), tableMeta).view as ListType).row_height).toBeUndefined()
  })
})
