import dayjs from 'dayjs'
import { defaultOffscreen2DContext, isBoxHovered, renderSingleLineText, renderTagLabel, truncateText } from '../utils/canvas'

export const YearCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const { selected, value, x, y, width, height, pv, padding, readonly, textColor = '#4a5268' } = props

    let text = ''

    if (value) {
      const year = dayjs(value.toString(), 'YYYY')
      if (year.isValid()) {
        text = year.format('YYYY')
      }
    }

    if (!value && selected && !readonly) {
      ctx.fillStyle = '#989FB1'
      ctx.font = '400 13px Manrope'
      const placeholderY = Math.max(y, 36)
      const truncatedFormat = truncateText(ctx, 'YYYY', width - padding * 2, true)
      ctx.fillText(truncatedFormat.text, x + padding, placeholderY + 16)
      return { x, y: placeholderY }
    }

    if (!text) {
      return {
        x,
        y,
      }
    }

    if (props.tag?.renderAsTag) {
      return renderTagLabel(ctx, { ...props, text })
    } else {
      const { x: xOffset, y: yOffset } = renderSingleLineText(ctx, {
        x: x + padding,
        y,
        text,
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
    if (!selected || !row?.rowMeta?.rowIndex) return false
    const bound = getCellPosition(column, row.rowMeta.rowIndex)
    const padding = 8

    const canvasContext = defaultOffscreen2DContext

    let textWidth = 0
    if (value) {
      const year = dayjs(value.toString(), 'YYYY')
      if (year.isValid()) {
        const text = year.format('YYYY')
        canvasContext.font = '500 13px Manrope'
        textWidth = canvasContext.measureText(text).width
      }
    } else {
      canvasContext.font = '400 13px Manrope'
      textWidth = canvasContext.measureText('YYYY').width
    }

    const clickableArea = {
      x: bound.x + padding,
      y: bound.y,
      width: textWidth,
      height: 33,
    }

    if (isBoxHovered(clickableArea, mousePosition)) {
      makeCellEditable(row, column)
      return true
    }
    return false
  },
  async handleKeyDown(ctx) {
    const { e, row, column, makeCellEditable } = ctx
    if (column.readonly) return
    if (e.key.length === 1) {
      makeCellEditable(row, column)
      return true
    }

    return false
  },
}
