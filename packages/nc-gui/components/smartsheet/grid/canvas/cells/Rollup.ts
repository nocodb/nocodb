import { renderSingleLineText } from '../utils/canvas'

const tagPadding = 8
const tagHeight = 20
const topPadding = 6

export const RollupCellRenderer: CellRenderer = {
  render: (ctx, { column, value, x, y, width, height, pv, padding }) => {
    const text = value?.toString()?.trim() ?? ''

    // If it is empty text then no need to render
    if (!text) return

    renderSingleLineText(ctx, {
      x: x + padding,
      y: y + padding,
      text,
      maxWidth: width - padding * 2,
      fontFamily: `500 13px Manrope`,
      fillStyle: '#4a5268',
      height,
    })
  },
}
