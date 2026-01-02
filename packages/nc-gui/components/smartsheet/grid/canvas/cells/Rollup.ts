import {
  type ColumnType,
  type LinkToAnotherRecordType,
  type RollupType,
  UITypes,
  getMetaWithCompositeKey,
  getRenderAsTextFunForUiType,
} from 'nocodb-sdk'
import { LinksCellRenderer } from './Links'

import rfdc from 'rfdc'

const clone = rfdc()
export const RollupCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const { column, value, metas, renderCell } = props

    // If it is empty text then no need to render
    if (!isValidValue(value)) return

    const colOptions = column.colOptions as RollupType
    const columnMeta = parseProp(column.meta)

    // Check if this rollup should be rendered as links
    if (columnMeta?.showAsLinks) {
      // Use the Links renderer - let the component handle readonly state
      return LinksCellRenderer.render?.(ctx, props)
    }

    const relatedColObj = metas?.[column.fk_model_id!]?.columns?.find(
      (c) => c.id === colOptions?.fk_relation_column_id,
    ) as ColumnType

    if (!relatedColObj) return

    const relatedTableMeta = metas?.[relatedColObj.colOptions?.fk_related_model_id]

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
  async handleClick(props) {
    const { column } = props
    const columnMeta = parseProp((column as any).meta)

    // If this rollup should be rendered as links, always delegate to Links handler
    // The readonly/editable behavior will be handled by the component itself
    if (columnMeta?.showAsLinks) {
      return LinksCellRenderer.handleClick?.(props) || false
    }

    return false
  },
  async handleKeyDown(props) {
    const { column } = props
    const columnMeta = parseProp((column as any).meta)

    // If this rollup should be rendered as links, always delegate to Links handler
    // The readonly/editable behavior will be handled by the component itself
    if (columnMeta?.showAsLinks) {
      return LinksCellRenderer.handleKeyDown?.(props) || false
    }

    return false
  },
}
