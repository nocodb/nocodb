import { getI18n } from '../../../../../plugins/a.i18n'
import { isBoxHovered, renderIconButton, renderMultiLineText, renderTagLabel } from '../utils/canvas'

export const JsonCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const {
      value,
      x,
      y,
      width,
      height,
      pv,
      padding,
      textColor = '#4a5268',
      mousePosition,
      spriteLoader,
      selected,
      setCursor,
    } = props

    const renderExpandIcon = () => {
      if (!selected) return

      renderIconButton(ctx, {
        buttonX: x + width - 28,
        buttonY: y + 7,
        buttonSize: 20,
        borderRadius: 6,
        iconData: {
          size: 12,
          xOffset: 4,
          yOffset: 4,
        },
        mousePosition,
        spriteLoader,
        icon: 'maximize',
        background: 'white',
        setCursor,
      })

      if (isBoxHovered({ x: x + width - 28, y: y + 7, width: 20, height: 20 }, mousePosition)) {
        setCursor('pointer')
      }
    }

    // skip rendering text if undefined/null
    if (ncIsUndefined(value) || ncIsNull(value)) {
      renderExpandIcon()

      return {
        x,
        y,
      }
    }

    let text = typeof value === 'string' ? value : JSON.stringify(value)

    // if invalid json string then stringify the value
    if (typeof text === 'string') {
      try {
        JSON.parse(text)
      } catch (e) {
        text = JSON.stringify(text)
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
        fontFamily: `${pv ? 600 : 500} 13px Inter`,
        fillStyle: pv ? '#3366FF' : textColor,
        height,
      })

      renderExpandIcon()

      return {
        x: xOffset,
        y: yOffset,
      }
    }
  },
  async handleKeyDown(ctx) {
    const { e, row, column, makeCellEditable } = ctx
    const columnObj = column.columnObj

    if (columnObj.title && (e.key.length === 1 || isExpandCellKey(e))) {
      makeCellEditable(row, column)
      return true
    }

    return false
  },
  async handleClick({ row, column, getCellPosition, mousePosition, makeCellEditable, selected }) {
    const rowIndex = row?.rowMeta?.rowIndex
    if (typeof rowIndex !== 'number' || !selected) return false
    const { x, y, width } = getCellPosition(column, rowIndex)
    if (isBoxHovered({ x: x + width - 28, y: y + 7, height: 20, width: 20 }, mousePosition)) {
      makeCellEditable(row, column)
      return true
    }
    return false
  },

  async handleHover({ row, column, mousePosition, getCellPosition, selected }) {
    const { tryShowTooltip, hideTooltip } = useTooltipStore()
    hideTooltip()
    if (!row || !column?.id || !mousePosition || column?.isInvalidColumn?.isInvalid || !selected) return

    const { x, y, width } = getCellPosition(column, row.rowMeta.rowIndex!)
    const expandIconBox = { x: x + width - 28, y: y + 7, width: 18, height: 18 }
    tryShowTooltip({ text: getI18n().global.t('tooltip.expandShiftSpace'), rect: expandIconBox, mousePosition })
  },
}
