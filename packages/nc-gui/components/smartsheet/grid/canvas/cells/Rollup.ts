import { type ColumnType, type RollupType, UITypes, getRenderAsTextFunForUiType } from 'nocodb-sdk'

import rfdc from 'rfdc'

const clone = rfdc()
export const RollupCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const { column, value, metas, meta, renderCell } = props

    // Helper to get meta with composite key
    const getMeta = (tableId: string) => {
      const baseId = meta?.base_id
      if (baseId) {
        return metas?.[`${baseId}:${tableId}`] || metas?.[tableId]
      }
      // Fallback: search through all metas to find matching tableId
      if (metas) {
        for (const [key, value] of Object.entries(metas)) {
          if (key.endsWith(`:${tableId}`)) {
            return value
          }
        }
      }
      return metas?.[tableId]
    }

    // If it is empty text then no need to render
    if (!isValidValue(value)) return

    const colOptions = column.colOptions as RollupType

    const relatedColObj = getMeta(column.fk_model_id!)?.columns?.find(
      (c) => c.id === colOptions?.fk_relation_column_id,
    ) as ColumnType

    if (!relatedColObj) return

    const relatedTableMeta = getMeta(relatedColObj.colOptions?.fk_related_model_id)

    const childColumn = clone((relatedTableMeta?.columns || []).find((c: ColumnType) => c.id === colOptions?.fk_rollup_column_id))

    if (!childColumn) return

    let renderProps: CellRendererOptions | undefined

    if (childColumn.uidt === UITypes.Formula) {
      const colMeta = parseProp(childColumn.meta)

      if (colMeta?.display_type) {
        renderProps = {
          ...props,
          column: {
            ...childColumn,
            uidt: colMeta?.display_type,
            ...colMeta.display_column_meta,
            meta: {
              ...parseProp(colMeta.display_column_meta),
              ...parseProp(column?.meta),
            },
          },
          readonly: true,
          formula: true,
        }
      }
    }

    if (!renderProps) {
      renderProps = {
        ...props,
        column: childColumn,
        relatedColObj: undefined,
        relatedTableMeta: undefined,
        readonly: true,
      }
    }

    const renderAsTextFun = getRenderAsTextFunForUiType((renderProps.column?.uidt as UITypes) || UITypes.SingleLineText)

    renderProps.column.meta = {
      ...parseProp(childColumn?.meta),
      ...parseProp(column?.meta),
    }

    if (colOptions?.rollup_function && renderAsTextFun.includes(colOptions?.rollup_function)) {
      // Render as decimal cell
      renderProps.column.uidt = UITypes.Decimal
    }

    renderCell(ctx, renderProps.column, renderProps)
  },
}
