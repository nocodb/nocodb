import { renderSingleLineText, renderTag, truncateText } from '../utils/canvas'
import type { getSingleMultiselectColOptions } from '../utils/cell'

const tagPadding = 8
const tagHeight = 22
const topPadding = 4

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
      fontFamily: `${pv ? 600 : 500} 13px Inter`,
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
      fontFamily: `${pv ? 600 : 500} 13px Inter`,
      fillStyle: getSelectTypeOptionTextColor(opColor),
    })

    return {
      x: x + padding + optionWidth + tagPadding * 2,
      y,
    }
  },
  async handleHover({ getCellPosition, column, row, value, mousePosition }) {
    const { x, y, width } = getCellPosition(column, row.rowMeta.rowIndex!)
    const { tryShowTooltip, hideTooltip } = useTooltipStore()
    hideTooltip()
    const padding = 10
    const maxWidth = width - padding * 2 - tagPadding * 2
    const ctx = document.createElement('canvas').getContext('2d')
    if (!ctx) return
    ctx.font = `${column.pv ? 600 : 500} 13px Inter`
    const text = value?.toString()?.trim() ?? ''
    // If it is empty text then no need to render
    if (!text) return
    const truncatedText = truncateText(ctx, text, maxWidth, true)
    if (text === truncatedText.text) return
    const box = { x: x + padding, y: y + topPadding, width: truncatedText.width + tagPadding * 2, height: tagHeight }

    tryShowTooltip({
      rect: box,
      mousePosition,
      text,
    })
  },

  async handleClick({ row, column, makeCellEditable, selected }) {
    if (column.readonly || column.columnObj?.readonly || !column?.isCellEditable || !selected) return false

    makeCellEditable(row, column)
    return true
  },

  async handleKeyDown({ e, row, column, makeCellEditable }) {
    if (column.readonly || column.columnObj?.readonly || !column?.isCellEditable) return false
    if (e.key.length === 1 || e.key === 'Enter') {
      makeCellEditable(row, column)
      return true
    }

    return false
  },
}
