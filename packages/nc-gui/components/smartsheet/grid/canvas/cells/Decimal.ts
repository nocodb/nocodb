import { roundUpToPrecision } from 'nocodb-sdk'
import { renderSingleLineText, renderTagLabel } from '../utils/canvas'

export const DecimalCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const { column, value, x, y, width, height, pv, padding, textColor = '#4a5268' } = props

    let displayValue = null
    const meta = parseProp(column?.meta)

    if (value !== null && !isNaN(Number(value))) {
      if (meta.isLocaleString) {
        displayValue = Number(roundUpToPrecision(Number(value), meta.precision ?? 1)).toLocaleString(undefined, {
          minimumFractionDigits: meta.precision ?? 1,
          maximumFractionDigits: meta.precision ?? 1,
        })
      } else {
        displayValue = roundUpToPrecision(Number(value), meta.precision ?? 1)
      }
    }

    const text = displayValue?.toString() ?? ''

    if (!isValidValue(text)) {
      return {
        x,
        y,
      }
    }

    if (props.tag?.renderAsTag) {
      return renderTagLabel(ctx, { ...props, text })
    } else {
      const { x: xOffset, y: yOffset } = renderSingleLineText(ctx, {
        x: x + width - padding,
        y,
        text,
        textAlign: 'right',
        maxWidth: width - padding * 2,
        fontFamily: `${pv ? 600 : 500} 13px Manrope`,
        fillStyle: pv ? '#3366FF' : textColor,
        height,
      })

      return {
        x: xOffset,
        y: yOffset,
      }
    }
  },
  async handleKeyDown(ctx) {
    const { e, row, column, makeCellEditable } = ctx
    if (column.readonly) return
    const columnObj = column.columnObj
    if (/^[0-9]$/.test(e.key) && columnObj.title) {
      row.row[columnObj.title] = ''
      makeCellEditable(row, column)
      return true
    }

    return false
  },
}
