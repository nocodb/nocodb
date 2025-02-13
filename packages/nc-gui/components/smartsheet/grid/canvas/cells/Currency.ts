import { renderSingleLineText, renderTagLabel } from '../utils/canvas'

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
      ...(parseProp(column?.meta) || {}),
    }

    let formattedValue = ''
    try {
      formattedValue = new Intl.NumberFormat(currencyMeta.currency_locale || 'en-US', {
        style: 'currency',
        currency: currencyMeta.currency_code || 'USD',
      }).format(value)
    } catch (e) {
      formattedValue = value.toString()
    }

    if (!value) {
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
    if (column.readonly) return false
    const columnObj = column.columnObj
    if (/^[0-9]$/.test(e.key) && columnObj.title) {
      row.row[columnObj.title] = ''
      makeCellEditable(row, column)
      return true
    }

    return false
  },
}
