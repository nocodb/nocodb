import { roundUpToPrecision } from 'nocodb-sdk'
import { renderSingleLineText, renderTagLabel } from '../utils/canvas'

export const DecimalCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const { column, selected, value, x, y, width, height, pv, padding, textColor = '#4a5268' } = props

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
        x: x + padding,
        y,
        text,
        maxWidth: width - padding * 2,
        fontFamily: `${pv ? 600 : 500} 13px Manrope`,
        fillStyle: selected || pv ? '#4351e8' : textColor,
        height,
      })

      return {
        x: xOffset,
        y: yOffset,
      }
    }
  },
}
