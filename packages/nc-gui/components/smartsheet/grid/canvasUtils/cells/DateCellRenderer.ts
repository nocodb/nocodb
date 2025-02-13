import dayjs from 'dayjs'
import type { CellRenderer } from '../useCellRenderer'
import { truncateText } from '../canvasUtils'

export const DateCellRenderer: CellRenderer = {
  render: (ctx, { value, x, y, width, height, selected, pv, column }) => {
    const padding = 10
    ctx.font = `${pv ? 600 : 500} 13px Manrope`
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'

    const dateFormat = parseProp(column?.meta)?.date_format ?? 'YYYY-MM-DD'
    let formattedDate = ''

    if (value) {
      const date = dayjs(/^\d+$/.test(value) ? +value : value, dateFormat)
      if (date.isValid()) {
        formattedDate = date.format(dateFormat)
      }
    }

    const maxWidth = width - padding * 2
    const truncatedText = truncateText(ctx, formattedDate, maxWidth)
    const textY = y + height / 2

    ctx.fillStyle = selected || pv ? '#4351e8' : '#4a5268'
    ctx.fillText(truncatedText, x + padding, textY)
  },
}
