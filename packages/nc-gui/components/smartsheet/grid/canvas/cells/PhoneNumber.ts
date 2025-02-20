import isMobilePhone from 'validator/lib/isMobilePhone'
import { defaultOffscreen2DContext, isBoxHovered, renderMultiLineText, renderTagLabel } from '../utils/canvas'

export const PhoneNumberCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const { value, x, y, width, height, pv, padding, textColor = '#4a5268', selected, setCursor } = props

    const text = value?.toString() ?? ''

    if (!text) {
      return {
        x,
        y,
      }
    }

    const isValid = text && isMobilePhone(text)

    if (props.tag?.renderAsTag) {
      return renderTagLabel(ctx, { ...props, text })
    } else {
      const { x: xOffset, y: yOffset } = renderMultiLineText(ctx, {
        x: x + padding,
        y,
        text,
        maxWidth: width - padding * 2,
        fontFamily: `${pv ? 600 : 500} 13px Manrope`,
        fillStyle: (isValid && selected) || pv ? '#3366FF' : textColor,
        height,
        underline: isValid,
      })

      const isHover = isBoxHovered(
        { x: x + padding, y: y + padding, width: xOffset - x - padding, height: yOffset - y },
        props.mousePosition,
      )

      if (isHover && isValid) {
        setCursor('pointer')
      }

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

    const { x, y, width, height } = getCellPosition(column, row.rowMeta.rowIndex!)
    const padding = 10

    const text = value?.toString() ?? ''

    const isValid = text && isMobilePhone(text)
    if (!isValid) return false

    const pv = column.pv
    const { x: xOffset, y: yOffset } = renderMultiLineText(defaultOffscreen2DContext, {
      x: x + padding,
      y: y + padding,
      text,
      maxWidth: width - padding * 2,
      fontFamily: `${pv ? 600 : 500} 13px Manrope`,
      height,
      render: false,
    })

    if (isBoxHovered({ x, y, width: xOffset - x, height: yOffset - y }, mousePosition)) {
      window.open(`tel:${text}`, '_blank')
      return true
    }
    return false
  },
}
