import dayjs from 'dayjs'
import { isBoxHovered, renderSingleLineText, renderTagLabel, truncateText } from '../utils/canvas'

export const YearCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const { selected, value, x, y, width, height, pv, padding, textColor = '#4a5268' } = props

    let text = ''

    if (value) {
      const year = dayjs(value.toString(), 'YYYY')
      if (year.isValid()) {
        text = year.format('YYYY')
      }
    }

    if (!value && selected) {
      ctx.fillStyle = '#989FB1'
      ctx.font = '400 13px Manrope'
      const truncatedFormat = truncateText(ctx, 'YYYY', width - padding * 2, true)
      ctx.fillText(truncatedFormat.text, x + padding, y + 16)
      return { x, y }
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
        fillStyle: selected || pv ? '#4351e8' : textColor,
        height,
      })

      return {
        x: xOffset,
        y: yOffset,
      }
    }
  },
  async handleClick(ctx) {
    const { row, column, makeCellEditable, getCellPosition, mousePosition, value } = ctx
    const bound = getCellPosition(column, row.rowMeta.rowIndex)
    const padding = 8

    const canvasContext = new OffscreenCanvas(0, 0).getContext('2d')!

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
      makeCellEditable(row.rowMeta.rowIndex, column)
      return true
    }
    return false
  },
}
