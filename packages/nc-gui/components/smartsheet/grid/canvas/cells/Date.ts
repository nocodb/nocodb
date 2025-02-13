import dayjs from 'dayjs'
import { renderSingleLineText, renderTagLabel } from '../utils/canvas'

export const DateCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const { column, value, x, y, width, height, pv, padding, textColor = '#4a5268', selected } = props

    const dateFormat = parseProp(column?.meta)?.date_format ?? 'YYYY-MM-DD'
    let formattedDate = ''

    if (value) {
      const date = dayjs(/^\d+$/.test(value) ? +value : value, dateFormat)
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
        fillStyle: selected || pv ? '#4351e8' : textColor,
        height,
      })

      return {
        x: xOffset,
        y: yOffset,
      }
    }
  },
}
