interface Position {
  x: number
  y: number
}

interface QRPayload {
  size: number
  position: Position
}

class QRPayloadRegistry {
  static #map = new Map<string, QRPayload>()
  static #getKey({ rowId, columnId }: { rowId: string; columnId: string }) {
    return `${rowId}-${columnId}`
  }

  static set({ rowId, columnId }: { rowId: string; columnId: string }, payload: QRPayload) {
    const key = this.#getKey({ rowId, columnId })
    this.#map.set(key, payload)
  }

  static get({ rowId, columnId }: { rowId: string; columnId: string }) {
    const key = this.#getKey({ rowId, columnId })
    return this.#map.get(key)
  }
}

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
      QRPayloadRegistry.set(
        { rowId: row.Id, columnId: column.id! },
        {
          position: { x: xPos, y: yPos },
          size,
        },
      )
    } else {
      imageLoader.renderPlaceholder(ctx, x + padding, y + padding, size, 'qr_code')
    }
  },

  async handleClick({ mousePosition, column, row }) {
    if (!row || !column) return
    const data = QRPayloadRegistry.get({ rowId: row.row.Id, columnId: column.id! })
    if (!data) return
    const { size, position } = data
    const { x: mouseX, y: mouseY } = mousePosition
    if (mouseX >= position.x && mouseX <= position.x + size && mouseY >= position.y && mouseY <= position.y + size) {
      setTimeout(() => {
        document.querySelector<HTMLElement>('.nc-canvas-table-editable-cell-wrapper .nc-qrcode-container > img')?.click()
      }, 100)
    }
  },
}
