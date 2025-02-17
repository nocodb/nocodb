import dayjs from 'dayjs'
import { truncateText } from '../utils/canvas'

export const YearCellRenderer: CellRenderer = {
  render: (ctx, { value, x, y, width, height, selected, pv }) => {
    const padding = 10
    ctx.font = `${pv ? 600 : 500} 13px Manrope`
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'

    let yearStr = ''
    if (value) {
      const year = dayjs(value.toString(), 'YYYY')
      if (year.isValid()) {
        yearStr = year.format('YYYY')
      }
    }

    const maxWidth = width - padding * 2
    const truncatedText = truncateText(ctx, yearStr, maxWidth)
    const textY = y + height / 2

    ctx.fillStyle = selected || pv ? '#4351e8' : '#4a5268'
    ctx.fillText(truncatedText, x + padding, textY)
  },
}
