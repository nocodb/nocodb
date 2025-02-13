import { getI18n } from '../../../../../plugins/a.i18n'
import { isBoxHovered, renderIconButton, renderMultiLineText, renderTagLabel } from '../utils/canvas'

export const JsonCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const { value, x, y, width, height, pv, padding, textColor = '#4a5268', mousePosition, spriteLoader } = props

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
        fillStyle: pv ? '#3366FF' : textColor,
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

    if (columnObj.title && e.key.length === 1) {
      makeCellEditable(row, column)
      return true
    }

    return false
  },
  async handleClick({ row, column, getCellPosition, mousePosition, makeCellEditable }) {
    const rowIndex = row?.rowMeta?.rowIndex
    if (typeof rowIndex !== 'number') return false
    const { x, y, width } = getCellPosition(column, rowIndex)
    if (isBoxHovered({ x: x + width - 28, y: y + 7, height: 18, width: 18 }, mousePosition)) {
      makeCellEditable(rowIndex, column)
      return true
    }
    return false
  },

  async handleHover({ row, column, mousePosition, getCellPosition }) {
    const { tryShowTooltip, hideTooltip } = useTooltipStore()
    hideTooltip()
    if (!row || !column?.id || !mousePosition || column?.isInvalidColumn?.isInvalid) return

    const { x, y, width } = getCellPosition(column, row.rowMeta.rowIndex!)
    const expandIconBox = { x: x + width - 28, y: y + 7, width: 18, height: 18 }
    tryShowTooltip({ text: getI18n().global.t('title.expand'), rect: expandIconBox, mousePosition })
  },
}
