import { renderMultiLineText } from '../utils/canvas'

export const QRCodeCellRenderer: CellRenderer = {
  render: (ctx, { value, x, y, width, height, column, imageLoader, padding, tag = {} }) => {
    const { renderAsTag } = tag
    padding = 4
    if (!value || value === 'ERR!') {
      if (value === 'ERR!') {
        renderMultiLineText(ctx, {
          x: x + padding,
          y,
          text: 'ERR!',
          maxWidth: width - padding * 2,
          fontFamily: '500 13px Manrope',
          fillStyle: '#e65100',
          height,
        })
      }
      return
    }

    const qrValue = String(value)
    const maxChars = 2000

    if (qrValue.length > maxChars) {
      renderMultiLineText(ctx, {
        x: x + padding,
        y,
        text: 'QR Code value too long!',
        maxWidth: width - padding * 2,
        fontFamily: '500 13px Manrope',
        fillStyle: '#e65100',
        height,
      })
      return
    }

    const meta = parseProp(column?.meta)

    let maxHeight

    if (pxToRowHeight[height] === 1) {
      maxHeight = height - 4
    } else {
      maxHeight = height - 20
    }

    const size = Math.min(width - padding * 2, maxHeight)

    const qrCanvas = imageLoader.loadOrGetQR(qrValue, size, {
      dark: meta.dark,
      light: meta.light,
    })

    if (qrCanvas) {
      const xPos = renderAsTag ? x + padding : x + (width - size) / 2
      const yPos = y + (height - size) / 2
      imageLoader.renderQRCode(ctx, qrCanvas, xPos, yPos, size)

      return {
        x: x + padding + size,
        y: yPos * 2,
      }
    } else {
      imageLoader.renderPlaceholder(ctx, x + padding, y + padding, size, 'qr_code')

      return {
        x: x + padding + size,
        y: y + padding + size,
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
