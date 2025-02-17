import { renderSingleLineText, roundedRect, truncateText } from '../utils/canvas'

const tagPadding = 8
const tagHeight = 20
const topPadding = 6

export const SingleSelectCellRenderer: CellRenderer = {
  render: (ctx, { column, value, x, y, width, height, pv }) => {
    const padding = 10

    const text = value?.toString()?.trim() ?? ''

    // If it is empty text then no need to render
    if (!text) return

    const { text: truncatedText, width: optionWidth } = renderSingleLineText(ctx, {
      x: x + padding + tagPadding,
      y: y + padding,
      text,
      maxWidth: width - padding * 2 - tagPadding * 2,
      textAlign: 'left',
      verticalAlign: 'middle',
      fontFamily: `${pv ? 600 : 500} 13px Manrope`,
      fillStyle: pv ? '#4351e8' : '#4a5268',
      height,
      render: false,
    })

    ctx.fillStyle = '#e7e7e9'
    ctx.beginPath()
    ctx.roundRect(x + padding, y + topPadding, optionWidth + tagPadding * 2, tagHeight, 12)
    ctx.fill()

    renderSingleLineText(ctx, {
      x: x + padding + tagPadding,
      y: y + padding,
      text: truncatedText,
      maxWidth: width - padding * 2 - tagPadding * 2,
      textAlign: 'left',
      verticalAlign: 'middle',
      fontFamily: `${pv ? 600 : 500} 13px Manrope`,
      fillStyle: pv ? '#4351e8' : '#4a5268',
      height,
    })
  },
}
