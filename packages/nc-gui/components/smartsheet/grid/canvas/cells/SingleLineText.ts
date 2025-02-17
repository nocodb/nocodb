import { renderSingleLineText, renderTag, truncateText } from '../utils/canvas'

export const SingleLineTextCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const { value, x, y, width, height, pv, padding, textColor = '#4a5268' } = props
    const { renderAsTag, tagPaddingX = 8, tagPaddingY = 4, tagHeight = 24 } = props.tag || {}

    ctx.font = `${pv ? 600 : 500} 13px Manrope`
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'

    const emailText = value?.toString() ?? ''
    const maxWidth = width - padding * 2
    const truncatedText = truncateText(ctx, emailText, maxWidth)
    const textY = y + height / 2
    ctx.fillStyle = pv ? '#4351e8' : '#4a5268'
    ctx.fillText(truncatedText, x + padding, textY)

    return

    // Fix me: truncateText() and renderSingleLineText uses same logic to slice extra text but the output is different which is causing issue
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

      console.log('ctx', truncateText(ctx, text, maxWidth), ctx.measureText(truncateText(ctx, text, maxWidth)).width)

      // const textY = y + height / 2
    }
  },
}
