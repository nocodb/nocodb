import { truncateText } from '../utils/canvas'
import type { CellRenderer } from '~/lib/types'

export const SingleLineTextCellRenderer: CellRenderer = {
  render: (ctx, { value, x, y, width, height, selected, pv }) => {
    const padding = 10
    ctx.font = `${pv ? 600 : 500} 13px Manrope`
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'

    const emailText = value?.toString() ?? ''
    const maxWidth = width - padding * 2
    const truncatedText = truncateText(ctx, emailText, maxWidth)
    const textY = y + height / 2
    ctx.fillStyle = pv ? '#4351e8' : '#4a5268'
    ctx.fillText(truncatedText, x + padding, textY)
  },
}
