import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import type { CellRenderer } from '../useCellRenderer'
import { timeCellMaxWidthMap, timeFormatsObj, truncateText } from '../canvasUtils'

dayjs.extend(utc)

export const DateTimeCellRenderer: CellRenderer = {
  render: (ctx, { value, x, y, width, height, selected, pv, column }) => {
    const padding = 10
    ctx.font = `${pv ? 600 : 500} 13px Manrope`
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'

    const columnMeta = parseProp(column?.meta)

    const dateFormat = columnMeta?.date_format ?? 'YYYY-MM-DD'
    const timeFormat = columnMeta?.time_format ?? 'HH:mm'
    const is12hrFormat = columnMeta?.is12hrFormat

    let dateTimeValue
    if (value && dayjs(value).isValid()) {
      dateTimeValue = dayjs(value).utc().local()
    }

    const dateStr = dateTimeValue?.format(dateFormat) ?? ''
    const dateWidth = Math.min(width * 0.6, 110)
    const truncatedDate = truncateText(ctx, dateStr, dateWidth - padding * 2)
    const textY = y + height / 2

    ctx.fillStyle = selected || pv ? '#4351e8' : '#4a5268'
    ctx.fillText(truncatedDate, x + padding, textY)

    const timeStr = dateTimeValue?.format(is12hrFormat ? timeFormatsObj[timeFormat] : timeFormat) ?? ''
    const timeMaxWidth = timeCellMaxWidthMap[timeFormat]?.[is12hrFormat ? 12 : 24] ?? 80
    const truncatedTime = truncateText(ctx, timeStr, timeMaxWidth - padding * 2)
    ctx.fillText(truncatedTime, x + dateWidth + padding, textY)
  },
}
