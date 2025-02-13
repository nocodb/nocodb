import { renderSingleLineText, renderTag, truncateText } from '../utils/canvas'

export const SingleLineTextCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const { value, x, y, width, height, pv, padding, textColor = '#4a5268' } = props
    const { renderAsTag, tagPaddingX = 8, tagPaddingY = 4, tagHeight = 24 } = props.tag || {}

    const text = value?.toString() ?? ''

    if (renderAsTag) {
      const maxWidth = width - padding * 2 - tagPaddingX * 2

      const { text: truncatedText, width: textWidth } = renderSingleLineText(ctx, {
        x: x + padding + tagPaddingX,
        y: y + padding,
        text,
        maxWidth,
        render: false,
      })

      renderTag(ctx, {
        x: x + padding,
        y: y + padding,
        width: textWidth + tagPaddingX * 2,
        height: tagHeight,
        radius: 12,
        fillStyle: textColor,
      })

      renderSingleLineText(ctx, {
        x: x + padding + tagPaddingX,
        y: y + padding,
        text: truncatedText,
        maxWidth: maxWidth,
        fontFamily: `${pv ? 600 : 500} 13px Manrope`,
        fillStyle: textColor,
      })
    } else {
      const maxWidth = width - padding * 2
      const { text: truncatedText, width: textWidth } = renderSingleLineText(ctx, {
        x: x + padding,
        y: y + padding,
        text,
        maxWidth,
        fontFamily: `${pv ? 600 : 500} 13px Manrope`,
        fillStyle: pv ? '#4351e8' : textColor,
      })

      // const textY = y + height / 2
    }
  },
}
