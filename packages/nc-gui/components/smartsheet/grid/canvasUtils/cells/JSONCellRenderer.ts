import { truncateText } from '../canvasUtils'
import type { CellRenderer } from '../useCellRenderer'

export const JsonCellRenderer: CellRenderer = {
  render: (ctx, { value, x, y, width, height, selected, pv }) => {
    const padding = 10
    ctx.font = `${pv ? 600 : 500} 13px Manrope`
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'

    let displayText = ''
    if (value) {
      displayText = typeof value === 'string' ? value : JSON.stringify(value)
    }

    const maxWidth = width - padding * 2
    const truncatedText = truncateText(ctx, displayText, maxWidth)
    const textY = y + height / 2

    ctx.fillStyle = selected || pv ? '#4351e8' : '#4a5268'
    ctx.fillText(truncatedText, x + padding, textY)
  },
}
