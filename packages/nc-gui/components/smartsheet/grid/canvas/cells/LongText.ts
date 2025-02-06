import { isAIPromptCol } from 'nocodb-sdk'
import { isBoxHovered, renderIconButton, renderMultiLineText, renderTagLabel } from '../utils/canvas'
import { AILongTextCellRenderer } from './AILongText'

export const LongTextCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    if (isAIPromptCol(props.column)) {
      AILongTextCellRenderer.render(ctx, props)
      return
    }

    const { value, x, y, width, height, pv, padding, textColor = '#4a5268', mousePosition, spriteLoader } = props

    const text = value?.toString() ?? ''

    const isHovered = isBoxHovered({ x, y, width, height }, mousePosition)

    if (!text) {
      return {
        x,
        y,
      }
    }

    if (props.tag?.renderAsTag) {
      return renderTagLabel(ctx, { ...props, text })
    } else {
      const { x: xOffset, y: yOffset } = renderMultiLineText(ctx, {
        x: x + padding,
        y,
        text,
        maxWidth: width - padding * 2,
        fontFamily: `${pv ? 600 : 500} 13px Manrope`,
        fillStyle: pv ? '#4351e8' : textColor,
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
  handleClick: async (props) => {
    const { column, getCellPosition, row, mousePosition, makeCellEditable } = props
    if (isAIPromptCol(column?.columnObj)) {
      return AILongTextCellRenderer.handleClick!(props)
    } else {
      const { x, y, width } = getCellPosition(column, row.rowMeta.rowIndex!)

      if (isBoxHovered({ x: x + width - 28, y: y + 7, width: 18, height: 18 }, mousePosition)) {
        makeCellEditable(row.rowMeta.rowIndex!, column)
        return true
      }
      return false
    }
  },
  async handleKeyDown(ctx) {
    const { e, row, column, makeCellEditable } = ctx
    if (/^[a-zA-Z0-9]$/.test(e.key)) {
      makeCellEditable(row.rowMeta!.rowIndex!, column)
      return true
    }

    return false
  },
  handleHover: async (props) => {
    if (isAIPromptCol(props.column?.columnObj)) {
      return AILongTextCellRenderer.handleHover?.(props)
    } else {
      return false
    }
  },
}
