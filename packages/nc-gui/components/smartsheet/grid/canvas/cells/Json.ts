import { isBoxHovered, renderIconButton, renderMultiLineText, renderTagLabel } from '../utils/canvas'

export const JsonCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const { selected, value, x, y, width, height, pv, padding, textColor = '#4a5268', mousePosition, spriteLoader } = props

    const isHovered = isBoxHovered({ x, y, width, height }, mousePosition)

    if (!value) {
      if (isHovered) {
        renderIconButton(ctx, {
          buttonX: x + width - 28,
          buttonY: y + 7,
          buttonSize: 18,
          borderRadius: 3,
          iconData: {
            size: 13,
            xOffset: (18 - 13) / 2,
            yOffset: (18 - 13) / 2,
          },
          mousePosition,
          spriteLoader,
          icon: 'maximize',
        })
      }

      return {
        x,
        y,
      }
    }

    const text = typeof value === 'string' ? value : JSON.stringify(value)

    if (props.tag?.renderAsTag) {
      return renderTagLabel(ctx, { ...props, text })
    } else {
      const { x: xOffset, y: yOffset } = renderMultiLineText(ctx, {
        x: x + padding,
        y,
        text,
        maxWidth: width - padding * 2,
        fontFamily: `${pv ? 600 : 500} 13px Manrope`,
        fillStyle: selected || pv ? '#4351e8' : textColor,
        height,
      })

      if (isHovered) {
        renderIconButton(ctx, {
          buttonX: x + width - 28,
          buttonY: y + 7,
          buttonSize: 18,
          borderRadius: 3,
          iconData: {
            size: 13,
            xOffset: (18 - 13) / 2,
            yOffset: (18 - 13) / 2,
          },
          mousePosition,
          spriteLoader,
          icon: 'maximize',
        })
      }

      return {
        x: xOffset,
        y: yOffset,
      }
    }
  },
  async handleKeyDown(ctx) {
    const { e, row, column, makeCellEditable } = ctx
    const columnObj = column.columnObj

    if (isTypableInputColumn(columnObj) && columnObj.title && e.key.length === 1) {
      row.row[columnObj.title] = row.row[columnObj.title] ? row.row[columnObj.title] + e.key : e.key
      makeCellEditable(row, column)
      return true
    }

    return false
  },
}
