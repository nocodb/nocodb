import { renderBarcode } from '../utils/canvas'

export const BarcodeCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const { value, x, y, width, height, column, tag = {} } = props
    const { renderAsTag } = tag

    return renderBarcode(ctx, {
      x,
      y,
      width,
      height,
      column,
      value: value.toString(),
      renderAsTag,
    })
  },
  async handleKeyDown(ctx) {
    const { e, row, column, makeCellEditable } = ctx

    if (e.key === 'Enter') {
      makeCellEditable(row, column)
      return true
    }

    return false
  },
}
