import { truncateText } from '../utils/canvas'

export const EmailCellRenderer: CellRenderer = {
  render: (ctx, { value, x, y, width, height, selected, pv }) => {
    const padding = 10
    ctx.font = `${pv ? 600 : 500} 13px Manrope`
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'

    const emailText = value?.toString() ?? ''
    const isValidEmail = emailText && validateEmail(emailText)
    const maxWidth = width - padding * 2
    const truncatedText = truncateText(ctx, emailText, maxWidth)
    const textY = y + height / 2

    // Draw the text
    ctx.fillStyle = (isValidEmail && selected) || pv ? '#4351e8' : '#4a5268'
    ctx.fillText(truncatedText, x + padding, textY)

    // Draw underline for valid email
    if (isValidEmail) {
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
