import { truncateText } from '../utils/canvas'
import type { CellRenderer } from '~/lib/types'

export const PercentCellRenderer: CellRenderer = {
  render: (ctx, { value, x, y, width, height, selected, pv, column }) => {
    const padding = 10
    ctx.font = `${pv ? 600 : 500} 13px Manrope`
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'

    const meta = {
      is_progress: false,
      ...parseProp(column?.meta),
    }

    if (meta.is_progress && value !== null && value !== undefined) {
      const percent = Number(parseFloat(value.toString()).toFixed(2))
      const barHeight = 4
      const barY = y + (height - barHeight) / 2
      const barWidth = (width - padding * 2) * (percent / 100)

      ctx.fillStyle = '#E5E5E5'
      ctx.fillRect(x + padding, barY, width - padding * 2, barHeight)

      ctx.fillStyle = '#3366FF'
      ctx.fillRect(x + padding, barY, barWidth, barHeight)
      return
    }

    const percentStr = value && !isNaN(Number(value)) ? `${value}%` : value?.toString() ?? ''
    const maxWidth = width - padding * 2
    const truncatedText = truncateText(ctx, percentStr, maxWidth)
    const textY = y + height / 2

    ctx.fillStyle = selected || pv ? '#4351e8' : '#4a5268'
    ctx.fillText(truncatedText, x + padding, textY)
  },
}
