import { getRenderAsTextFunForUiType, UITypes, type ColumnType, type RollupType } from 'nocodb-sdk'
import { DecimalCellRenderer } from './Decimal'

export const RollupCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const { column, value, relatedTableMeta, renderCell } = props

    // If it is empty text then no need to render
    if (!isValidValue(value)) return

    const colOptions = column.colOptions as RollupType

    const childColumn = (relatedTableMeta?.columns || []).find((c: ColumnType) => c.id === colOptions?.fk_rollup_column_id)

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
      DecimalCellRenderer.render(ctx, renderProps)
    } else if (childColumn) {
      renderCell(ctx, childColumn, renderProps)
    }
  },
}
