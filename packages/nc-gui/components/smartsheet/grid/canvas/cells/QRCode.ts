export const QRCodeCellRenderer: CellRenderer = {
  render: (ctx, { value, x, y, width, height, column, imageLoader, padding, row }) => {
    padding = 4
    if (!value || value === 'ERR!') {
      if (value === 'ERR!') {
        imageLoader.renderError(ctx, 'ERR!', x, y, width, height)
      }
      return
    }

    const qrValue = String(value)
    const maxChars = 2000

    if (qrValue.length > maxChars) {
      imageLoader.renderError(ctx, 'QR Code value too long', x, y, width, height)
      return
    }

    const meta = parseProp(column?.meta)
    const size = Math.min(width - padding * 2, height - padding)

    const qrCanvas = imageLoader.loadOrGetQR(qrValue, size, {
      dark: meta.dark,
      light: meta.light,
    })

    if (qrCanvas) {
      const xPos = x + (width - size) / 2
      const yPos = y + (height - size) / 2
      imageLoader.renderQRCode(ctx, qrCanvas, xPos, yPos, size)
    } else {
      imageLoader.renderPlaceholder(ctx, x + padding, y + padding, size, 'qr_code')
    }
  },

  async handleClick({ mousePosition, column, row, getCellPosition }) {
    if (!row || !column) return
    const position = getCellPosition(column, row?.rowMeta?.rowIndex)
    if (!position) return

    const padding = 10
    const size = Math.min(position.width - padding * 2, position.height - padding)
    const contentX = position.x + (position.width - size) / 2
    const contentY = position.y + (position.height - size) / 2

    const { x: mouseX, y: mouseY } = mousePosition

    if (mouseX >= contentX && mouseX <= contentX + size && mouseY >= contentY && mouseY <= contentY + size) {
      setTimeout(() => {
        document.querySelector<HTMLElement>('.nc-canvas-table-editable-cell-wrapper .nc-qrcode-container > img')?.click()
      }, 100)
    }
  },
}
