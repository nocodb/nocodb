import { isBoxHovered, renderBarcode } from '../utils/canvas'
import { validateBarcode } from '../utils/cell'
import { getI18n } from '../../../../../plugins/a.i18n'

export const BarcodeCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const { value, x, y, width, height, column, tag = {}, spriteLoader, cellRenderStore } = props
    const { renderAsTag } = tag
    const returnValue = renderBarcode(ctx, {
      x,
      y,
      width,
      height,
      column,
      value: (value ?? '').toString(),
      renderAsTag,
      spriteLoader,
    })

    if (returnValue?.startX) {
      Object.assign(cellRenderStore, {
        x: returnValue.startX,
        y: returnValue.startY,
        width: returnValue.width,
        height: returnValue.height,
      })
    }

    return returnValue ? { x: returnValue.x, y: returnValue.y } : undefined
  },
  async handleKeyDown(ctx) {
    const { e, row, column, makeCellEditable, value } = ctx
    if (e.key === 'Enter') {
      const isValidBarCode = validateBarcode(value, column.columnObj).isValid
      if (!isValidBarCode) {
        return true
      }
      makeCellEditable(row, column)
      return true
    }

    return false
  },
  async handleHover({ column, row, getCellPosition, value, mousePosition }) {
    const { x, y, width } = getCellPosition(column, row.rowMeta.rowIndex!)

    const { tryShowTooltip } = useTooltipStore()

    const isValidBarCode = validateBarcode(value, column.columnObj).isValid
    if (!isValidBarCode) {
      const box = { x: x + width - 23, y: y + 9, width: 16, height: 16 }
      tryShowTooltip({
        rect: box,
        text: getI18n().global.t('msg.warning.barcode.renderError'),
        mousePosition,
      })
    }
  },
  async handleClick(ctx) {
    const { row, column, makeCellEditable, value, isDoubleClick, selected, cellRenderStore, mousePosition } = ctx
    const { x, y, width, height } = cellRenderStore
    let showOnSingleClick = false

    if (x && y && width && height) {
      showOnSingleClick = selected && isBoxHovered({ x, y, width, height }, mousePosition)
    }

    if (isDoubleClick || showOnSingleClick) {
      const isValidBarCode = validateBarcode(value, column.columnObj).isValid
      if (!isValidBarCode) {
        return true
      }
      makeCellEditable(row, column)
      return true
    }
    return false
  },
}
