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
    const { row, column, makeCellEditable, getCellPosition, mousePosition } = ctx
    const bound = getCellPosition(column, row.rowMeta.rowIndex)

    if (isBoxHovered({ x: bound.x, y: bound.y, width: bound.width, height: 33 }, mousePosition)) {
      makeCellEditable(row.rowMeta.rowIndex, column)
      return true
    }
    return false
  },
}
