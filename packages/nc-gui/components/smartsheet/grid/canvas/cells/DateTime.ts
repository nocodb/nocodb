import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import { truncateText } from '../utils/canvas'
import { timeCellMaxWidthMap, timeFormatsObj } from '../utils/cell'

dayjs.extend(utc)

export const DateTimeCellRenderer: CellRenderer = {
  render: (ctx, { value, x, y, width, selected, pv, column, padding }) => {
    ctx.font = `${pv ? 600 : 500} 13px Manrope`
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'

    const columnMeta = parseProp(column?.meta)

    const dateFormat = columnMeta?.date_format ?? 'YYYY-MM-DD'
    const timeFormat = columnMeta?.time_format ?? 'HH:mm'
    const is12hrFormat = columnMeta?.is12hrFormat

    if (!value && selected) {
      ctx.fillStyle = '#989FB1'
      ctx.font = '400 13px Manrope'

      const totalAvailableWidth = width - padding * 3
      const dateWidth = Math.min(width * 0.6, 110)
      const timeWidth = Math.min(timeCellMaxWidthMap[timeFormat]?.[is12hrFormat ? 12 : 24] ?? 80, totalAvailableWidth - dateWidth)

      const truncatedDateFormat = truncateText(ctx, dateFormat, dateWidth - padding)
      ctx.fillText(truncatedDateFormat, x + padding, y + 16)

      const truncatedTimeFormat = truncateText(ctx, timeFormat, timeWidth)
      const timeX = x + dateWidth + padding
      ctx.fillText(truncatedTimeFormat, timeX, y + 16)
    }

    let dateTimeValue
    if (value && dayjs(value).isValid()) {
      dateTimeValue = dayjs(value).utc().local()
    }

    const dateStr = dateTimeValue?.format(dateFormat) ?? ''
    const dateWidth = Math.min(width * 0.6, 110)
    const truncatedDate = truncateText(ctx, dateStr, dateWidth - padding * 2)
    const textY = y + 16

    ctx.fillStyle = pv ? '#4351e8' : '#4a5268'
    ctx.fillText(truncatedDate, x + padding, textY)

    const timeStr = dateTimeValue?.format(is12hrFormat ? timeFormatsObj[timeFormat] : timeFormat) ?? ''
    const timeMaxWidth = timeCellMaxWidthMap[timeFormat]?.[is12hrFormat ? 12 : 24] ?? 80
    const truncatedTime = truncateText(ctx, timeStr, timeMaxWidth - padding * 2)
    ctx.fillText(truncatedTime, x + dateWidth + padding, textY)
  },
}
