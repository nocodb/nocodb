import { renderSingleLineText, renderTag } from '../utils/canvas'
import type { getSingleMultiselectColOptions } from '../utils/cell'

const tagPadding = 8
const tagHeight = 20
const topPadding = 6

export const SingleSelectCellRenderer: CellRenderer = {
  render: (ctx, { column, value, x, y, width, height, pv, padding }) => {
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
      render: false,
    })

    const opColor = (column.extra as ReturnType<typeof getSingleMultiselectColOptions>)?.optionsMap?.[text]?.color ?? '#e7e7e9'

    renderTag(ctx, {
      x: x + padding,
      y: y + topPadding,
      width: optionWidth + tagPadding * 2,
      height: tagHeight,
      radius: 12,
      fillStyle: opColor,
    })

    renderSingleLineText(ctx, {
      x: x + padding + tagPadding,
      y: y + padding,
      text: truncatedText,
      maxWidth: width - padding * 2 - tagPadding * 2,
      textAlign: 'left',
      verticalAlign: 'middle',
      fontFamily: `${pv ? 600 : 500} 13px Manrope`,
      fillStyle: getSelectTypeOptionTextColor(opColor),
    })
  },
}
