import { renderMultiLineText, renderTagLabel } from '../utils/canvas'

export const JsonCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const { selected, value, x, y, width, height, pv, padding, textColor = '#4a5268' } = props

    if (!value) {
      return {
        x,
        y,
      }
    }

    const text = typeof value === 'string' ? value : JSON.stringify(value)

    if (props.tag?.renderAsTag) {
      return renderTagLabel(ctx, { ...props, text })
    } else {
      const { x: xOffset, y: yOffset } = renderMultiLineText(ctx, {
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
