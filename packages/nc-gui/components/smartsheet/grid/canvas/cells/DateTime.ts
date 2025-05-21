import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import { type TimeZone } from '@vvo/tzdb'
import { defaultOffscreen2DContext, isBoxHovered, truncateText } from '../utils/canvas'
import { timeCellMaxWidthMap, timeFormatsObj } from '../utils/cell'

dayjs.extend(utc)

export const DateTimeCellRenderer: CellRenderer = {
  render: (ctx, { value, x, y, width, selected, pv, column, padding, readonly }) => {
    ctx.font = `${pv ? 600 : 500} 13px Inter`
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'

    const columnMeta = parseProp(column?.meta)
    const dateFormat = columnMeta?.date_format ?? 'YYYY-MM-DD'
    const timeFormat = columnMeta?.time_format ?? 'HH:mm'
    const timezone = column?.extra?.timezone as TimeZone
    const isDisplayTimezone = column?.extra?.isDisplayTimezone as TimeZone

    const is12hrFormat = columnMeta?.is12hrFormat
    const isValueValid = value && dayjs(value).isValid()
    const timezoneWidth = isValueValid && isDisplayTimezone ? ctx.measureText(timezone.abbreviation).width + 8 : 0

    const totalAvailableWidth = width - padding * 3
    const dateTimeWidth = totalAvailableWidth - timezoneWidth
    const dateWidth = Math.min(dateTimeWidth * 0.6, 110)
    const timeWidth = Math.min(timeCellMaxWidthMap[timeFormat]?.[is12hrFormat ? 12 : 24] ?? 80, dateTimeWidth - dateWidth)
    const textY = y + 16

    if (!value && selected && !readonly) {
      ctx.fillStyle = '#989FB1'
      ctx.font = '400 13px Inter'

      const truncatedDateFormat = truncateText(ctx, dateFormat, dateWidth - padding)
      ctx.fillText(truncatedDateFormat, x + padding, textY)

      const truncatedTimeFormat = truncateText(ctx, timeFormat, timeWidth)
      const timeX = x + dateWidth + padding
      ctx.fillText(truncatedTimeFormat, timeX, textY)
      return
    }

    let dateTimeValue
    if (isValueValid) {
      if (timezone) {
        const { timezonize: timezonizeDayjs } = withTimezone(timezone.name)

        dateTimeValue = timezonizeDayjs(dayjs(value))
      } else {
        dateTimeValue = dayjs(value).utc().local()
      }
    }

    const dateStr = dateTimeValue?.format(dateFormat) ?? ''
    const truncatedDate = truncateText(ctx, dateStr, dateWidth - 4 * 2)

    ctx.fillStyle = pv ? '#3366FF' : '#4a5268'
    ctx.fillText(truncatedDate, x + padding, textY)

    const timeStr = dateTimeValue?.format(is12hrFormat ? timeFormatsObj[timeFormat] : timeFormat) ?? ''
    const truncatedTime = truncateText(ctx, timeStr, timeWidth)
    ctx.fillText(truncatedTime, x + dateWidth + padding * 2, textY)
    if (timezoneWidth && timezoneWidth > 0) {
      const gray400 = '#6A7184'
      const oldFillStyle = ctx.fillStyle
      const oldFont = ctx.font
      ctx.font = ctx.font = `500 11px Inter`
      ctx.fillStyle = gray400
      ctx.fillText(timezone!.abbreviation, x + dateTimeWidth + padding * 3.5, textY)
      ctx.font = oldFont
      ctx.fillStyle = oldFillStyle
    }
  },

  async handleClick(ctx) {
    const { row, column, makeCellEditable, getCellPosition, mousePosition, value, selected } = ctx
    const bound = getCellPosition(column, row.rowMeta.rowIndex)
    const padding = 8
    if (!selected || column.readonly) return false

    const canvasContext = defaultOffscreen2DContext

    canvasContext.font = '500 13px Inter'

    const columnMeta = parseProp(column?.columnObj?.meta)
    const dateFormat = columnMeta?.date_format ?? 'YYYY-MM-DD'
    const timeFormat = columnMeta?.time_format ?? 'HH:mm'
    const is12hrFormat = columnMeta?.is12hrFormat

    const dateWidth = Math.min(bound.width * 0.6, 110)
    const timeMaxWidth = timeCellMaxWidthMap[timeFormat]?.[is12hrFormat ? 12 : 24] ?? 80

    let dateText, timeText
    if (value && dayjs(value).isValid()) {
      const dateTimeValue = dayjs(value).utc().local()
      dateText = dateTimeValue.format(dateFormat)
      timeText = dateTimeValue.format(is12hrFormat ? timeFormatsObj[timeFormat] : timeFormat)
    } else {
      dateText = dateFormat
      timeText = timeFormat
      canvasContext.font = '400 13px Inter'
    }

    if (dateText) {
      const dateArea = {
        x: bound.x + padding,
        y: bound.y,
        width: Math.min(canvasContext.measureText(dateText).width, dateWidth - padding * 2),
        height: 33,
      }

      if (isBoxHovered(dateArea, mousePosition)) {
        makeCellEditable(row, column)
        return true
      }
    }

    if (timeText) {
      const timeArea = {
        x: bound.x + dateWidth + padding,
        y: bound.y,
        width: Math.min(canvasContext.measureText(timeText).width, timeMaxWidth - padding * 2),
        height: 33,
      }

      if (isBoxHovered(timeArea, mousePosition)) {
        makeCellEditable(row, column)
        return true
      }
    }
    return false
  },
  async handleKeyDown(ctx) {
    const { e, row, column, makeCellEditable } = ctx
    if (column.readonly || !column?.isCellEditable) return
    if (e.key.length === 1) {
      makeCellEditable(row, column)
      return true
    }

    return false
  },
}
