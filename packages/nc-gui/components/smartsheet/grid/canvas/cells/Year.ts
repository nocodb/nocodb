import dayjs from 'dayjs'
import { renderSingleLineText, renderTagLabel } from '../utils/canvas'

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
}
