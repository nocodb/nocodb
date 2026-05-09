import {
  SeparatorType,
  formatNumberWithSeparator,
  getSeparatorChars,
  resolveColumnSeparator,
  roundUpToPrecision,
} from 'nocodb-sdk'
import { renderSingleLineText, renderTagLabel } from '../utils/canvas'

export const DecimalCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const { column, value, x, y, width, height, pv, padding, textColor = themeV4Colors.gray['600'], getColor } = props

    let displayValue = null
    const meta = parseProp(column?.meta)

    if (value !== null && !isNaN(Number(value))) {
      const separator = resolveColumnSeparator(meta)
      const precision = meta.precision ?? 1
      const numValue = Number(roundUpToPrecision(Number(value), precision))

      if (separator === SeparatorType.Locale) {
        displayValue = numValue.toLocaleString(undefined, {
          minimumFractionDigits: precision,
          maximumFractionDigits: precision,
        })
      } else {
        const { thousandSeparator, decimalSeparator } = getSeparatorChars(separator)
        displayValue = formatNumberWithSeparator(numValue, thousandSeparator, decimalSeparator, precision)
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
  async handleKeyDown(ctx) {
    const { e, row, column, makeCellEditable } = ctx
    if (column.readonly || column.columnObj?.readonly) return
    const columnObj = column.columnObj
    if (/^[0-9]$/.test(e.key) && columnObj.title) {
      // default null as to not raise error
      row.row[columnObj.title] = null
      makeCellEditable(row, column)
      return true
    }

    return false
  },
}
