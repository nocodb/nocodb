import { roundUpToPrecision, isFieldAgentCol } from 'nocodb-sdk'
import { renderSingleLineText, renderTagLabel } from '../utils/canvas'
import { AISelectCellRenderer } from './AISelect'

export const CurrencyRenderer: CellRenderer = {
  render: (ctx, props) => {
    const { column, value, x, y, width, height, pv, padding, textColor = themeV4Colors.gray['600'], getColor } = props

    // Field Agent: render the "Run Agent" button when cell has no valid value
    if ((!isValidValue(value) || isNaN(value)) && isFieldAgentCol(column)) {
      return AISelectCellRenderer.render(ctx, props)
    }

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
    if (isFieldAgentCol(column?.columnObj) && (!isValidValue(value) || isNaN(value))) {
      return AISelectCellRenderer.handleClick!(props)
    }
    return false
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
