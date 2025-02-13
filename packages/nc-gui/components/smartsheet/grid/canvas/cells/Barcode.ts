import JsBarcode from 'jsbarcode'
import { truncateText } from '../utils/canvas'

export const BarcodeCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const { value, x, y, width, height, column, padding } = props

    if (!value) return

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

      const availableWidth = width - padding * 2
      const xPos = x + padding

      ctx.drawImage(tempCanvas, xPos, y + padding, availableWidth, height - padding * 2)
    } catch (error) {
      ctx.font = `500 13px Manrope`
      ctx.textBaseline = 'middle'
      ctx.textAlign = 'left'

      const truncatedText = truncateText(ctx, value.toString(), width - padding * 2)
      ctx.fillText(truncatedText, x + padding, y + height / 2)

      ctx.fillStyle = '#ff0000'
      ctx.fillRect(x + width - 4, y + 4, 2, 2)
    }
  },
}
