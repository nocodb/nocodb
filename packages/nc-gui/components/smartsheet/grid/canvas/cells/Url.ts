import { truncateText } from '../utils/canvas'

export const UrlCellRenderer: CellRenderer = {
  render: (ctx, { value, x, y, width, height, selected, pv, column }) => {
    const padding = 10
    ctx.font = `${pv ? 600 : 500} 13px Manrope`
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'

    const urlText = value?.toString().trim() ?? ''
    const isValid = urlText && isValidURL(urlText)
    const maxWidth = width - padding * 2

    const displayText = isValid ? urlText : ''

    const truncatedText = truncateText(ctx, displayText, maxWidth)
    const textY = y + height / 2
    const textMetrics = ctx.measureText(truncatedText)

    ctx.fillStyle = (isValid && selected) || pv ? '#4351e8' : '#4a5268'
    ctx.fillText(truncatedText, x + padding, textY)

    if (isValid) {
      ctx.beginPath()
      ctx.moveTo(x + padding, textY + 6)
      ctx.lineTo(x + padding + textMetrics.width, textY + 6)
      ctx.strokeStyle = selected ? '#4351e8' : '#4a5268'
      ctx.lineWidth = 1
      ctx.stroke()
    }

    if (parseProp(column?.meta).validate && !isValid && urlText.length) {
      const iconSize = 16
      const iconX = x + width - iconSize - padding

      ctx.fillStyle = '#f87171'
      ctx.beginPath()
      ctx.arc(iconX + iconSize / 2, textY, iconSize / 2, 0, 2 * Math.PI)
      ctx.fill()

      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 12px sans-serif'
      ctx.fillText('i', iconX + 6, textY + 2)
    }
  },
}
