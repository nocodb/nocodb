import dayjs from 'dayjs'
import { defaultOffscreen2DContext, isBoxHovered, renderSingleLineText, renderTagLabel, truncateText } from '../utils/canvas'

const defaultDateFormat = 'YYYY-MM-DD'

export const DateCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const { column, value, x, y, width, height, pv, padding, textColor = '#4a5268', selected, readonly } = props

    const dateFormat = parseProp(column?.meta)?.date_format ?? defaultDateFormat
    let formattedDate = ''

    if (!value && selected && !readonly) {
      ctx.fillStyle = '#989FB1'
      ctx.font = '400 13px Manrope'
      const placeholderY = Math.max(y, 36)
      const truncatedFormat = truncateText(ctx, dateFormat, width - padding * 2)
      ctx.fillText(truncatedFormat, x + padding, placeholderY + 16)
      return { x, y: placeholderY }
    }

    if (value) {
      const date = dayjs(/^\d+$/.test(value) ? +value : value, defaultDateFormat)
      if (date.isValid()) {
        formattedDate = date.format(dateFormat)
      }
    }

    if (!formattedDate) {
      return {
        x,
        y,
      }
    }

    if (props.tag?.renderAsTag) {
      return renderTagLabel(ctx, { ...props, text: formattedDate })
    } else {
      const { x: xOffset, y: yOffset } = renderSingleLineText(ctx, {
        x: x + padding,
        y,
        text: formattedDate,
        maxWidth: width - padding * 2,
        fontFamily: `${pv ? 600 : 500} 13px Manrope`,
        fillStyle: pv ? '#3366FF' : textColor,
        height,
      })

      return {
        x: xOffset,
        y: yOffset,
      }
    }
  },

  async handleClick(ctx) {
    const { row, column, makeCellEditable, getCellPosition, mousePosition, value, selected } = ctx
    if (!selected) return false
    const bound = getCellPosition(column, row.rowMeta.rowIndex!)
    const padding = 8

    const canvasContext = defaultOffscreen2DContext

    const dateFormat = parseProp(column?.columnObj?.meta)?.date_format ?? 'YYYY-MM-DD'
    let text = ''

    if (value) {
      const date = dayjs(/^\d+$/.test(value) ? +value : value, dateFormat)
      if (date.isValid()) {
        text = date.format(dateFormat)
      }
    } else {
      text = dateFormat
      canvasContext.font = '400 13px Manrope'
    }

    if (text) {
      canvasContext.font = value ? '500 13px Manrope' : '400 13px Manrope'
      const textWidth = canvasContext.measureText(text).width

      const clickableArea = {
        x: bound.x + padding,
        y: bound.y,
        width: Math.min(textWidth, bound.width - padding * 2),
        height: 33,
      }

      if (isBoxHovered(clickableArea, mousePosition)) {
        makeCellEditable(row, column)
        return true
      }
    }

    return false
  },
  async handleKeyDown(ctx) {
    const { e, row, column, makeCellEditable } = ctx
    if (column.readonly) return false
    if (e.key.length === 1) {
      makeCellEditable(row, column)
      return true
    }

    return false
  },
}
