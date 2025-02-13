import dayjs from 'dayjs'
import { renderSingleLineText, renderTagLabel } from '../utils/canvas'

export const TimeCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const { column, selected, value, x, y, width, height, pv, padding, textColor = '#4a5268' } = props

    if (!value) {
      return {
        x,
        y,
      }
    }

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
        text = time.format(parseProp(column?.meta)?.is12hrFormat ? 'hh:mm A' : 'HH:mm')
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
