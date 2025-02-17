import { renderBarcode } from '../utils/canvas'
import { MouseClickType, getMouseClickType, validateBarcode } from '../utils/cell'
import { getI18n } from '../../../../../plugins/a.i18n'

export const BarcodeCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const { value, x, y, width, height, column, tag = {}, spriteLoader } = props
    const { renderAsTag } = tag

    return renderBarcode(ctx, {
      x,
      y,
      width,
      height,
      column,
      value: (value ?? '').toString(),
      renderAsTag,
      spriteLoader,
    })
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
    const { event, row, column, makeCellEditable, value } = ctx
    if (getMouseClickType(event) === MouseClickType.DOUBLE_CLICK) {
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
