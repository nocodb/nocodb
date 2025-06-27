import { type ColumnType, type RollupType, UITypes, getRenderAsTextFunForUiType, parseProp } from 'nocodb-sdk'
import rfdc from 'rfdc'
import { isBoxHovered } from '../utils/canvas'
import { LinksCellRenderer } from './Links'

const clone = rfdc()
export const RollupCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const { column, value, metas, renderCell } = props

    // If it is empty text then no need to render
    if (!isValidValue(value)) return

    const colOptions = column.colOptions as RollupType
    const columnMeta = parseProp(column.meta)

    const relatedColObj = metas?.[column.fk_model_id!]?.columns?.find(
      (c: ColumnType) => c.id === colOptions?.fk_relation_column_id,
    ) as ColumnType

    if (!relatedColObj) return

    // Check if this rollup should be rendered as links
    if (columnMeta?.showAsLinks) {
      // Use the Links renderer - let the component handle readonly state
      return LinksCellRenderer.render?.(ctx, {
        ...props,
        column: {
          ...column,
          uidt: UITypes.Links,
          meta: {
            ...parseProp(relatedColObj?.meta),
            ...parseProp(column?.meta),
          },
        },
      })
    }

    const relatedTableMeta = metas?.[(relatedColObj.colOptions as RollupType)?.fk_related_model_id]

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
    const { column, row, getCellPosition, mousePosition, makeCellEditable, selected, isDoubleClick } = props
    const columnMeta = parseProp(column.columnObj?.meta)

    // If this rollup should be rendered as links, handle the click directly
    if (columnMeta?.showAsLinks) {
      if (!selected && !isDoubleClick) return false

      const rowIndex = row.rowMeta.rowIndex!
      const { x, y, width, height } = getCellPosition(column, rowIndex)
      const padding = 10
      const buttonSize = 16

      // Check if click is within the cell area (similar to Links renderer)
      if (
        isBoxHovered({ x: x + width - 16 - padding, y: y + 7, height: buttonSize, width: buttonSize }, mousePosition) ||
        isBoxHovered({ x: x + padding, y, height, width: width - padding * 2 }, mousePosition)
      ) {
        // Make the ORIGINAL rollup column editable, not the extracted relation column
        makeCellEditable(row, column)
        return true
      }
    }

    return false
  },
  async handleKeyDown(props) {
    const { column, row, e, makeCellEditable } = props
    const columnMeta = parseProp(column.columnObj?.meta)

    // If this rollup should be rendered as links, handle keyboard events
    if (columnMeta?.showAsLinks) {
      if (isExpandCellKey(e)) {
        // Make the ORIGINAL rollup column editable, not the extracted relation column
        makeCellEditable(row, column)
        return true
      }
    }

    return false
  },
}
