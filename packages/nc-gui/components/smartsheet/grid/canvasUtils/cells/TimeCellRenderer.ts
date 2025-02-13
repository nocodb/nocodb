import dayjs from 'dayjs'
import type { CellRenderer } from '../useCellRenderer'
import { truncateText } from '../canvasUtils'

export const TimeCellRenderer: CellRenderer = {
  render: (ctx, { value, x, y, width, height, selected, pv, column }) => {
    const padding = 10
    ctx.font = `${pv ? 600 : 500} 13px Manrope`
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'

    let timeStr = ''
    if (value) {
      let time = dayjs(value)
      if (!time.isValid()) {
        time = dayjs(value, 'HH:mm:ss')
      }
      if (!time.isValid()) {
        time = dayjs(`1999-01-01 ${value}`)
      }
      if (time.isValid()) {
        timeStr = time.format(column?.meta?.is12hrFormat ? 'hh:mm A' : 'HH:mm')
      }
    }

    const maxWidth = width - padding * 2
    const truncatedText = truncateText(ctx, timeStr, maxWidth)
    const textY = y + height / 2

    ctx.fillStyle = selected || pv ? '#4351e8' : '#4a5268'
    ctx.fillText(truncatedText, x + padding, textY)
  },
}
