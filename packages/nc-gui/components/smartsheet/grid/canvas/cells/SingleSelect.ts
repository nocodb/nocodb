import { renderSingleLineText, roundedRect, truncateText } from '../utils/canvas'

export const SingleSelectCellRenderer: CellRenderer = {
  render: (ctx, { column, value, x, y, width, height, pv }) => {
    const padding = 10

    const text = value?.toString() ?? ''

    renderSingleLineText(ctx, {
      x: x + padding,
      y,
      text: text,
      maxWidth: width - padding * 2,
      textAlign: 'left',
      verticalAlign: 'middle',
      fontFamily: `${pv ? 600 : 500} 13px Manrope`,
      fillStyle: pv ? '#4351e8' : '#4a5268',
      height
    })
  },
}
