import { renderSingleLineText, renderTagLabel } from '../utils/canvas'
import { roundUpToPrecision } from 'nocodb-sdk'

export const CurrencyRenderer: CellRenderer = {
  render: (ctx, props) => {
    const { column, value, x, y, width, height, pv, padding, textColor = '#4a5268' } = props

    if (!isValidValue(value) || isNaN(value)) {
      return {
        x,
        y,
      }
    }

    const currencyMeta = {
      currency_locale: 'en-US',
      currency_code: 'USD',
      precision: 2,
      ...(parseProp(column?.meta) || {}),
    }

    let formattedValue = ''
    try {
      // Round the value to the specified precision
      const roundedValue = roundUpToPrecision(Number(value), currencyMeta.precision ?? 2)
      
      formattedValue = new Intl.NumberFormat(currencyMeta.currency_locale || 'en-US', {
        style: 'currency',
        currency: currencyMeta.currency_code || 'USD',
        minimumFractionDigits: currencyMeta.precision ?? 2,
        maximumFractionDigits: currencyMeta.precision ?? 2,
      }).format(roundedValue)
    } catch (e) {
      formattedValue = value.toString()
    }

    if (ncIsUndefined(value) || ncIsNull(value)) {
      return {
        x,
        y,
      }
    }

    if (props.tag?.renderAsTag) {
      return renderTagLabel(ctx, { ...props, text: formattedValue })
    } else {
      const { x: xOffset, y: yOffset } = renderSingleLineText(ctx, {
        x: x + width - padding,
        y,
        textAlign: 'right',
        text: formattedValue,
        maxWidth: width - padding * 2,
        fontFamily: `${pv ? 600 : 500} 13px Inter`,
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
    if (column.readonly || column.columnObj?.readonly) return false
    const columnObj = column.columnObj
    if (/^[0-9]$/.test(e.key) && columnObj.title) {
      row.row[columnObj.title] = ''
      makeCellEditable(row, column)
      return true
    }

    return false
  },
}
