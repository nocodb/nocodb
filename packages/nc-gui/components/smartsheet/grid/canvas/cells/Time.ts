import dayjs from 'dayjs'
import { isBoxHovered, renderSingleLineText, renderTagLabel, truncateText } from '../utils/canvas'

export const TimeCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const { column, selected, value, x, y, width, height, pv, padding, textColor = '#4a5268' } = props

    if (!value) {
      return {
        x,
        y,
      }
    }

    const timeFormat = parseProp(column?.meta)?.is12hrFormat ? 'hh:mm A' : 'HH:mm'
    let text = ''

    if (value) {
      let time = dayjs(value)
      if (!time.isValid()) {
        time = dayjs(value, 'HH:mm:ss')
      }
      if (!time.isValid()) {
        time = dayjs(`1999-01-01 ${value}`)
      }
      if (time.isValid()) {
        text = time.format(timeFormat)
      }
    }

    if (props.tag?.renderAsTag) {
      return renderTagLabel(ctx, { ...props, text })
    } else {
      if (!value && selected) {
        ctx.fillStyle = '#989FB1'
        ctx.font = '400 13px Manrope'
        const truncatedFormat = truncateText(ctx, timeFormat, width - padding * 2)
        ctx.fillText(truncatedFormat, x + padding, y + 16)
        return { x, y }
      }

      const { x: xOffset, y: yOffset } = renderSingleLineText(ctx, {
        x: x + padding,
        y,
        text,
        maxWidth: width - padding * 2,
        fontFamily: `${pv ? 600 : 500} 13px Manrope`,
        fillStyle: pv ? '#4351e8' : textColor,
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

    const timeFormat = parseProp(column?.columnObj?.meta)?.is12hrFormat ? 'hh:mm A' : 'HH:mm'
    let text = ''

    if (value) {
      canvasContext.font = '500 13px Manrope'
      let time = dayjs(value)
      if (!time.isValid()) {
        time = dayjs(value, 'HH:mm:ss')
      }
      if (!time.isValid()) {
        time = dayjs(`1999-01-01 ${value}`)
      }
      if (time.isValid()) {
        text = time.format(timeFormat)
      }
    } else {
      text = timeFormat
      canvasContext.font = '400 13px Manrope'
    }

    if (text) {
      const textWidth = canvasContext.measureText(text).width
      const clickableArea = {
        x: bound.x + padding,
        y: bound.y,
        width: Math.min(textWidth, bound.width - padding * 2),
        height: 33,
      }

      if (isBoxHovered(clickableArea, mousePosition)) {
        makeCellEditable(row.rowMeta.rowIndex, column)
        return true
      }
    }

    return false
  },
}
