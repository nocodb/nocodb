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

    const maxWidth = 131.2 // Max width constraint (could be a fixed value or calculated elsewhere)
    const availableWidth = Math.min(width - padding * 2, maxWidth) // Use props.width as the actual column width
    let maxHeight = height - padding * 2

    if (pxToRowHeight[height] === 1) {
      maxHeight = height - 4
    } else {
      maxHeight = height - 20
    }

    try {
      JsBarcode(tempCanvas, value.toString(), {
        format,
        // width: 2,
        // height: height - padding * 2,
        displayValue: false,
        lineColor: '#000000',
        margin: 0,
        fontSize: 12,
        font: 'Manrope',
      })

      // Calculate the aspect ratio of the generated barcode
      const aspectRatio = tempCanvas.width / tempCanvas.height

      // Determine the scaling factor based on max width and height
      const scaleFactor = Math.min(maxWidth / tempCanvas.width, maxHeight / tempCanvas.height)

      // Calculate the new width and height for the barcode
      const newWidth = tempCanvas.width * scaleFactor

      // If the width exceeds the available width, scale it down accordingly
      const finalWidth = renderAsTag ? Math.min(75, width - padding * 2) : newWidth > availableWidth ? availableWidth : newWidth

      // Calculate the final height to maintain the aspect ratio
      const finalHeight = renderAsTag ? height - padding * 2 : finalWidth / aspectRatio // Adjust the height to maintain the aspect ratio
      // Determine the xPos for centering the barcode (if not rendering as a tag)
      const xPos = renderAsTag ? x + padding : x + (width - finalWidth) / 2

      ctx.drawImage(tempCanvas, xPos, y + height / 2 - finalHeight / 2, finalWidth, finalHeight)

      return {
        x: xPos + finalWidth + 8,
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
