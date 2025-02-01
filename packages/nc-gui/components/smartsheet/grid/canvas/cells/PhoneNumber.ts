import isMobilePhone from 'validator/lib/isMobilePhone'
import { renderMultiLineText, renderSingleLineText, renderTag } from '../utils/canvas'

export const PhoneNumberCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const { value, x, y, width, height, pv, padding, textColor = '#4a5268', selected } = props
    const { renderAsTag, tagPaddingX = 8, tagHeight = 20, tagRadius = 6, tagBgColor = '#f4f4f0' } = props.tag || {}

    const text = value?.toString() ?? ''

    const isValid = text && isMobilePhone(text)

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
        borderColor: themeV3Colors.gray['200'],
        borderWidth: 1,
      })

      renderSingleLineText(ctx, {
        x: x + padding + tagPaddingX,
        y: y,
        text: truncatedText,
        maxWidth: maxWidth,
        fontFamily: `${pv ? 600 : 500} 13px Manrope`,
        fillStyle: textColor,
        underline: isValid,
      })

      return {
        x: x + padding + textWidth + tagPaddingX * 2,
        y: y + padding - 4 + tagHeight,
      }
    } else {
      const { x: xOffset, y: yOffset } = renderMultiLineText(ctx, {
        x: x + padding,
        y,
        text,
        maxWidth: width - padding * 2,
        fontFamily: `${pv ? 600 : 500} 13px Manrope`,
        fillStyle: (isValid && selected) || pv ? '#4351e8' : textColor,
        height,
        underline: isValid,
      })

      return {
        x: xOffset,
        y: yOffset,
      }
    }
  },
}
