import { defaultOffscreen2DContext, isBoxHovered, renderMultiLineText, renderTagLabel, truncateText } from '../utils/canvas'

export const EmailCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const { value, x, y, width, height, selected, pv, padding, textColor = '#4a5268' } = props

    const text = value?.toString() ?? ''

    if (!text) {
      return {
        x,
        y,
      }
    }

    const isValidEmail = text && validateEmail(text)

    if (props.tag?.renderAsTag) {
      return renderTagLabel(ctx, { ...props, text })
    } else {
      const { x: xOffset, y: yOffset } = renderMultiLineText(ctx, {
        x: x + padding,
        y,
        text,
        maxWidth: width - padding * 2,
        fontFamily: `${pv ? 600 : 500} 13px Manrope`,
        fillStyle: (isValidEmail && selected) || pv ? '#3366FF' : textColor,
        underline: isValidEmail,
        height,
      })

      return {
        x: xOffset,
        y: yOffset,
      }
    }
  },
  async handleKeyDown(ctx) {
    const { e, row, column, makeCellEditable } = ctx
    if (column.readonly) return
    const columnObj = column.columnObj

    if (e.key.length === 1 && columnObj.title) {
      row.row[columnObj.title] = ''
      makeCellEditable(row, column)
      return true
    }

    return false
  },
  async handleClick({ value, row, column, getCellPosition, mousePosition }) {
    if (!row || !column) return false
    const { x, y, width } = getCellPosition(column, row.rowMeta.rowIndex!)
    const padding = 10
    const text = value?.toString() ?? ''
    const isValid = text && validateEmail(text)
    if (!isValid) return false
    const pv = column.pv
    const ctx = defaultOffscreen2DContext
    ctx.font = `${pv ? 600 : 500} 13px Manrope`

    const maxWidth = width - padding * 2
    const truncatedText = truncateText(ctx, text, maxWidth)
    const textMetrics = ctx.measureText(truncatedText)

    if (isBoxHovered({ x, y, width: textMetrics.width, height: 18 }, mousePosition)) {
      window.open(`mailto:${text}`, '_blank')
      return true
    }
    return false
  },
}
