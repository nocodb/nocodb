import { renderSingleLineText, renderTag, truncateText } from '../utils/canvas'

export const SingleLineTextCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const { value, x, y, width, height, pv, padding, textColor = '#4a5268' } = props
    const { renderAsTag, tagPaddingX = 8, tagHeight = 20, tagRadius = 6, tagBgColor = '#f4f4f0' } = props.tag || {}

    const text = value?.toString() ?? ''

    if (renderAsTag) {
      const maxWidth = width - padding * 2 - tagPaddingX * 2

      const { text: truncatedText, width: textWidth } = renderSingleLineText(ctx, {
        x: x + padding + tagPaddingX,
        y: y + padding,
        text,
        maxWidth,
        fontFamily: `${pv ? 600 : 500} 13px Manrope`,
        render: false,
      })

      renderTag(ctx, {
        x: x + padding,
        y: y + padding - 4,
        width: textWidth + tagPaddingX * 2,
        height: tagHeight,
        radius: tagRadius,
        fillStyle: tagBgColor,
      })

      renderSingleLineText(ctx, {
        x: x + padding + tagPaddingX,
        y: y + padding,
        text: truncatedText,
        maxWidth: maxWidth,
        fontFamily: `${pv ? 600 : 500} 13px Manrope`,
        fillStyle: textColor,
        height,
      })

      return {
        x: x + padding + textWidth + tagPaddingX * 2,
        y: y + padding - 4 + tagHeight,
      }
    } else {
      const { x: xOffset, y: yOffset } = renderSingleLineText(ctx, {
        x: x + padding,
        y: y + padding,
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
}
