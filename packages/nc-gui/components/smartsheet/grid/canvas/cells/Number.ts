import { parseIntValue, isFieldAgentCol } from 'nocodb-sdk'
import { renderSingleLineText, renderTagLabel } from '../utils/canvas'
import { AISelectCellRenderer } from './AISelect'

export const FloatCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const { value, x, y, width, height, pv, padding, textColor = themeV4Colors.gray['600'], getColor, column } = props

    const numericValue = parseIntValue(value, column)
    // Field Agent: render the "Run Agent" button when cell has no valid value
    if (!isValidValue(numericValue) && isFieldAgentCol(column)) {
      return AISelectCellRenderer.render(ctx, props)
    }
    if (!isValidValue(numericValue)) {
      return {
        x,
        y,
      }
    }
    const text = numericValue.toString()

    if (props.tag?.renderAsTag) {
      return renderTagLabel(ctx, { ...props, text })
    } else {
      const { x: xOffset, y: yOffset } = renderSingleLineText(ctx, {
        x: x + width - padding,
        y,
        textAlign: 'right',
        text,
        maxWidth: width - padding * 2,
        fontFamily: `${pv ? 600 : 500} 13px Inter`,
        fillStyle: pv ? getColor(themeV4Colors.brand['500']) : getColor(textColor),
        height,
      })

      return {
        x: xOffset,
        y: yOffset,
      }
    }
  },
  async handleClick(props) {
    const { column, row, value } = props
    // Field Agent: delegate click to AISelectCellRenderer for empty cells
    if (isFieldAgentCol(column?.columnObj) && !isValidValue(value)) {
      return AISelectCellRenderer.handleClick!(props)
    }
    return false
  },
  async handleKeyDown(ctx) {
    const { e, row, column, makeCellEditable } = ctx
    if (column.readonly || column.columnObj?.readonly) return
    const columnObj = column.columnObj

    if (/^[0-9]$/.test(e.key) && columnObj.title) {
      row.row[columnObj.title] = ''
      makeCellEditable(row, column)
      return true
    }

    return false
  },
}
