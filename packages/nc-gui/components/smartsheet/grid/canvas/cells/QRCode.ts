import QRCode from 'qrcode'
import { truncateText } from '../utils/canvas'

export const QRCodeCellRenderer: CellRenderer = {
  render: async (ctx, props) => {
    const { value, x, y, width, height, column } = props
    const padding = 10

    if (!value || value === 'ERR!') {
      if (value === 'ERR!') {
        ctx.font = `500 13px Manrope`
        ctx.textBaseline = 'middle'
        ctx.textAlign = 'left'
        ctx.fillStyle = '#e65100'
        ctx.fillText('ERR!', x + padding, y + height / 2)
      }
      return
    }

    const qrValue = String(value)
    const maxChars = 2000

    if (qrValue.length > maxChars) {
      ctx.font = `500 13px Manrope`
      ctx.textBaseline = 'middle'
      ctx.textAlign = 'left'
      ctx.fillStyle = '#e65100'
      const errorText = 'QR Code value too long'
      const truncatedError = truncateText(ctx, errorText, width - padding * 2)
      ctx.fillText(truncatedError, x + padding, y + height / 2)
      return
    }

    const meta = parseProp(column?.meta)

    try {
      const tempCanvas = document.createElement('canvas')
      await QRCode.toCanvas(tempCanvas, qrValue, {
        margin: 1,
        scale: 4,
        width: Math.min(width - padding * 2, height - padding * 2),
        color: {
          dark: meta.dark || '#000000',
          light: meta.light || '#ffffff',
        },
      })

      const size = Math.min(width - padding * 2, height - padding)
      const xPos = x + (width - size) / 2
      const yPos = y + (height - size) / 2

      ctx.drawImage(tempCanvas, xPos, yPos, size, size)
    } catch (error) {
      ctx.font = `500 13px Manrope`
      ctx.textBaseline = 'middle'
      ctx.textAlign = 'left'
      ctx.fillStyle = '#e65100'

      const errorText = 'Error generating QR code'
      const truncatedError = truncateText(ctx, errorText, width - padding * 2)
      ctx.fillText(truncatedError, x + padding, y + height / 2)
    }
  },
}
