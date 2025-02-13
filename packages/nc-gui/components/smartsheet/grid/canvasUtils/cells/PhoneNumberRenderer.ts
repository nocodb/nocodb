import isMobilePhone from 'validator/lib/isMobilePhone'
import { truncateText } from '../canvasUtils'
import type { CellRenderer } from '../useCellRenderer'

export const PhoneNumberCellRenderer: CellRenderer = {
  render: (ctx, { value, x, y, width, height, selected, pv }) => {
    const padding = 10
    ctx.font = `${pv ? 600 : 500} 13px Manrope`
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'

    const phoneText = value?.toString() ?? ''
    const isValid = phoneText && isMobilePhone(phoneText)
    const maxWidth = width - padding * 2
    const truncatedText = truncateText(ctx, phoneText, maxWidth)
    const textY = y + height / 2

    ctx.fillStyle = (isValid && selected) || pv ? '#4351e8' : '#4a5268'
    ctx.fillText(truncatedText, x + padding, textY)

    if (isValid) {
      const textMetrics = ctx.measureText(truncatedText)
      ctx.beginPath()
      ctx.moveTo(x + padding, textY + 6)
      ctx.lineTo(x + padding + textMetrics.width, textY + 6)
      ctx.strokeStyle = selected ? '#4351e8' : '#4a5268'
      ctx.lineWidth = 1
      ctx.stroke()
    }
  },
}
