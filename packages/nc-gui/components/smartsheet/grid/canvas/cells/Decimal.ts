import { roundUpToPrecision } from 'nocodb-sdk'
import { truncateText } from '../utils/canvas'
import type { CellRenderer } from '~/lib/types'

export const DecimalCellRenderer: CellRenderer = {
  render: (ctx, { value, x, y, width, height, selected, pv, column }) => {
    const padding = 10
    ctx.fillStyle = '#4a5268'
    ctx.font = `${pv ? 600 : 500} 13px Manrope`
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'right'

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

    const maxWidth = width - padding * 2
    const truncatedText = truncateText(ctx, displayValue?.toString() ?? '', maxWidth)
    const textY = y + height / 2

    ctx.fillStyle = selected || pv ? '#4351e8' : '#4a5268'
    ctx.fillText(truncatedText, x + width - padding, textY)
  },
}
