import { isFieldAgentCol } from 'nocodb-sdk'
import { renderMultiLineText, renderTagLabel } from '../utils/canvas'
import { AISelectCellRenderer } from './AISelect'

export const SingleLineTextCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const { value, x, y, width, height, pv, padding, textColor = themeV4Colors.gray['600'], getColor, formula, column } = props
    const text = (Array.isArray(value) ? value.join(',') : value?.toString()) ?? ''

    // Field Agent: render the "Run Agent" button when cell is empty
    if (!text && isFieldAgentCol(column)) {
      return AISelectCellRenderer.render(ctx, props)
    }

    if (!text) {
      return {
        x,
        y,
      }
    }

    if (props.tag?.renderAsTag) {
      return renderTagLabel(ctx, { ...props, text })
    } else {
      const { x: xOffset, y: yOffset } = renderMultiLineText(ctx, {
        x: x + padding,
        y,
        text,
        maxWidth: width - padding * 2,
        fontFamily: `${pv ? 600 : 500} 13px Inter`,
        fillStyle: pv ? getColor(themeV4Colors.brand['500']) : getColor(textColor),
        height,
        renderAsPreTag: formula,
      })

      return {
        x: xOffset,
        y: yOffset,
      }
    }
  },
  async handleClick(props) {
    const { column, row, makeCellEditable, selected, value } = props
    // Field Agent: delegate click to AISelectCellRenderer for empty cells
    if (isFieldAgentCol(column?.columnObj) && !value) {
      return AISelectCellRenderer.handleClick!(props)
    }
    return false
  },
  async handleKeyDown(ctx) {
    const { e, row, column, makeCellEditable } = ctx
    if (column.readonly || column.columnObj?.readonly) return

    const columnObj = column.columnObj

    if (e.key.length === 1 && columnObj.title) {
      row.row[columnObj.title] = ''
      makeCellEditable(row, column)
      return true
    }

    return false
  },
}
