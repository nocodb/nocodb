import { renderSingleLineText, renderTagLabel } from '../utils/canvas'

export const DurationCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const { column, value, x, y, width, height, pv, padding, textColor = '#4a5268', selected } = props

    if (!isValidValue(value)) {
      return {
        x,
        y,
      }
    }

    const durationType = parseProp(column?.meta)?.duration || 0
    const text = convertMS2Duration(value, durationType)

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
