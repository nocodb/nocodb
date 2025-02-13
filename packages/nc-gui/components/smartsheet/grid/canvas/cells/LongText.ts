import { truncateText } from '../utils/canvas'

export const LongTextCellRenderer: CellRenderer = {
  render: (ctx, { value, x, y, width, height, selected, pv, column, padding }) => {
    ctx.fillStyle = '#4a5268'
    ctx.font = `${pv ? 600 : 500} 13px Manrope`
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'

    const emailText = (value?.toString() ?? '').split('\n')[0]
    const maxWidth = width - padding * 2
    const truncatedText = truncateText(ctx, emailText, maxWidth)
    const textY = y + height / 2
    ctx.fillStyle = selected || pv ? '#4351e8' : '#4a5268'
    ctx.fillText(truncatedText, x + padding, textY)
  },
}
