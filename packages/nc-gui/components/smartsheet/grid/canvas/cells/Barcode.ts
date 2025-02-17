import JsBarcode from 'jsbarcode'
import { truncateText } from '../utils/canvas'

export const BarcodeCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const { value, x, y, width, height, column, tag = {} } = props
    const { renderAsTag } = tag

    if (!value) return
    const padding = 4

    const meta = parseProp(column?.meta)
    const format = meta.barcodeFormat || 'CODE128'

    const tempCanvas = document.createElement('canvas')

    try {
      JsBarcode(tempCanvas, value.toString(), {
        format,
        width: 2,
        height: height - padding * 2,
        displayValue: false,
        lineColor: '#000000',
        margin: 0,
        fontSize: 12,
        font: 'Manrope',
      })

      const availableWidth = renderAsTag ? Math.min(75, width - padding * 2) : width - padding * 2
      const xPos = x + padding

      ctx.drawImage(tempCanvas, xPos, y + padding, availableWidth, height - padding * 2)

      return {
        x: xPos + availableWidth + 8,
        y: y + height - padding * 2,
      }
    } catch (error) {
      ctx.font = `500 13px Manrope`
      ctx.textBaseline = 'middle'
      ctx.textAlign = 'left'
      ctx.fillStyle = '#4a5268'

      const { text, width: textWidth } = truncateText(ctx, value.toString(), width - padding * 2, true)
      ctx.fillText(text, x + padding, y + height / 2)

      ctx.fillStyle = '#ff0000'
      ctx.fillRect(x + (renderAsTag ? textWidth + 4 : width - 4), y + 4, 2, 2)

      return {
        x: x + padding + textWidth + 4,
        y: y + height / 2 + 13,
      }
    }
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
