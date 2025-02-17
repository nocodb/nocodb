import { renderMultiLineText, renderTagLabel } from '../utils/canvas'

export const EmailCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const { value, x, y, width, height, selected, pv, padding, textColor = '#4a5268' } = props

    const text = value?.toString() ?? ''

    if (!text) {
      return {
        x,
        y,
      }
    }

    const isValidEmail = text && validateEmail(text)

    if (props.tag?.renderAsTag) {
      return renderTagLabel(ctx, { ...props, text })
    } else {
      const { x: xOffset, y: yOffset } = renderMultiLineText(ctx, {
        x: x + padding,
        y: y,
        text,
        maxWidth: width - padding * 2,
        fontFamily: `${pv ? 600 : 500} 13px Manrope`,
        fillStyle: (isValidEmail && selected) || pv ? '#4351e8' : textColor,
        underline: isValidEmail,
        height,
      })

      return {
        x: xOffset,
        y: yOffset,
      }
    }
  },
}
