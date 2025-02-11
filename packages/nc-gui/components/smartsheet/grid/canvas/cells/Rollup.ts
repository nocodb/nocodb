import { type ColumnType, type RollupType, UITypes, getRenderAsTextFunForUiType } from 'nocodb-sdk'

import rfdc from 'rfdc'

const clone = rfdc()
export const RollupCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const { column, value, metas, renderCell } = props

    // If it is empty text then no need to render
    if (!isValidValue(value)) return

    const colOptions = column.colOptions as RollupType

    const relatedColObj = metas?.[column.fk_model_id!]?.columns?.find(
      (c) => c.id === colOptions?.fk_relation_column_id,
    ) as ColumnType

    if (!relatedColObj) return

    const relatedTableMeta = metas?.[relatedColObj.colOptions?.fk_related_model_id]

    const childColumn = clone((relatedTableMeta?.columns || []).find((c: ColumnType) => c.id === colOptions?.fk_rollup_column_id))

    if (!childColumn) return

    const renderAsTextFun = getRenderAsTextFunForUiType((childColumn?.uidt as UITypes) || UITypes.SingleLineText)
    const renderProps: CellRendererOptions = {
      ...props,
      column: childColumn,
      relatedColObj: undefined,
      relatedTableMeta: undefined,
      readonly: true,
    }

    if (colOptions?.rollup_function && renderAsTextFun.includes(colOptions?.rollup_function)) {
      // Render as decimal cell
      renderProps.column.uidt = UITypes.Decimal
      renderProps.column.meta = {
        ...parseProp(childColumn?.meta),
        ...parseProp(column?.meta),
      }
    }
    renderCell(ctx, childColumn, renderProps)
  },
}
