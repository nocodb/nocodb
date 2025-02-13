import { isBoxHovered, renderSingleLineText, renderTag, truncateText } from '../utils/canvas'
import type { getSingleMultiselectColOptions } from '../utils/cell'

const tagPadding = 8
const tagHeight = 20
const topPadding = 6

export const SingleSelectCellRenderer: CellRenderer = {
  render: (ctx, { column, value, x, y, width, pv, padding }) => {
    const text = value?.toString()?.trim() ?? ''

    // If it is empty text then no need to render
    if (!text) return

    const { text: truncatedText, width: optionWidth } = renderSingleLineText(ctx, {
      x: x + padding + tagPadding,
      y,
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
      y,
      text: truncatedText,
      maxWidth: width - padding * 2 - tagPadding * 2,
      textAlign: 'left',
      verticalAlign: 'middle',
      fontFamily: `${pv ? 600 : 500} 13px Manrope`,
      fillStyle: getSelectTypeOptionTextColor(opColor),
    })
  },
  async handleHover({ getCellPosition, column, row, value, mousePosition }) {
    const { x, y, width } = getCellPosition(column, row.rowMeta.rowIndex!)
    const { showTooltip, hideTooltip } = useTooltipStore()
    hideTooltip()
    const padding = 10
    const maxWidth = width - padding * 2 - tagPadding * 2
    const ctx = document.createElement('canvas').getContext('2d')
    if (!ctx) return
    ctx.font = `${column.pv ? 600 : 500} 13px Manrope`
    const text = value?.toString()?.trim() ?? ''
    // If it is empty text then no need to render
    if (!text) return
    const truncatedText = truncateText(ctx, text, maxWidth, true)
    console.log({ text, truncatedText: truncatedText.text })
    if (text === truncatedText.text) return
    const box = { x: x + padding, y: y + topPadding, width: truncatedText.width + tagPadding * 2, height: tagHeight }
    if (isBoxHovered(box, mousePosition)) {
      showTooltip({
        position: {
          x: mousePosition.x,
          y: mousePosition.y,
        },
        text,
      })
    }
  },
}
