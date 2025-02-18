import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import { defaultOffscreen2DContext, isBoxHovered, truncateText } from '../utils/canvas'
import { timeCellMaxWidthMap, timeFormatsObj } from '../utils/cell'

dayjs.extend(utc)

export const DateTimeCellRenderer: CellRenderer = {
  render: (ctx, { value, x, y, width, selected, pv, column, padding, readonly }) => {
    ctx.font = `${pv ? 600 : 500} 13px Manrope`
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'

    const columnMeta = parseProp(column?.meta)
    const dateFormat = columnMeta?.date_format ?? 'YYYY-MM-DD'
    const timeFormat = columnMeta?.time_format ?? 'HH:mm'
    const is12hrFormat = columnMeta?.is12hrFormat

    const totalAvailableWidth = width - padding * 3
    const dateWidth = Math.min(width * 0.6, 110)
    const timeWidth = Math.min(timeCellMaxWidthMap[timeFormat]?.[is12hrFormat ? 12 : 24] ?? 80, totalAvailableWidth - dateWidth)
    const textY = y + 16

    if (!value && selected && !readonly) {
      ctx.fillStyle = '#989FB1'
      ctx.font = '400 13px Manrope'

      const truncatedDateFormat = truncateText(ctx, dateFormat, dateWidth - padding)
      ctx.fillText(truncatedDateFormat, x + padding, textY)

      const truncatedTimeFormat = truncateText(ctx, timeFormat, timeWidth)
      const timeX = x + dateWidth + padding
      ctx.fillText(truncatedTimeFormat, timeX, textY)
      return
    }

    let dateTimeValue
    if (value && dayjs(value).isValid()) {
      dateTimeValue = dayjs(value).utc().local()
    }

    const dateStr = dateTimeValue?.format(dateFormat) ?? ''
    const truncatedDate = truncateText(ctx, dateStr, dateWidth - padding * 2)

    ctx.fillStyle = pv ? '#3366FF' : '#4a5268'
    ctx.fillText(truncatedDate, x + padding, textY)

    const timeStr = dateTimeValue?.format(is12hrFormat ? timeFormatsObj[timeFormat] : timeFormat) ?? ''
    const truncatedTime = truncateText(ctx, timeStr, timeWidth)
    ctx.fillText(truncatedTime, x + dateWidth + padding, textY)
  },

  async handleClick(ctx) {
    const { row, column, makeCellEditable, getCellPosition, mousePosition, value, selected } = ctx
    const bound = getCellPosition(column, row.rowMeta.rowIndex)
    const padding = 8
    if (!selected || column.readonly) return false

    const canvasContext = defaultOffscreen2DContext

    canvasContext.font = '500 13px Manrope'

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
      canvasContext.font = '400 13px Manrope'
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
