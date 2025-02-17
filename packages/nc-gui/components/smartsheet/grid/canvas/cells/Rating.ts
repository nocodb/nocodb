interface Position {
  x: number
  y: number
}

interface RatingPayload {
  iconSize: number
  iconsData: Position[]
}

class RatingPayloadRegistry {
  static #map = new Map<string, RatingPayload>()
  static #getKey({ rowId, columnId }: { rowId: string; columnId: string }) {
    return `${rowId}-${columnId}`
  }

  static set({ rowId, columnId }: { rowId: string; columnId: string }, payload: RatingPayload) {
    const key = this.#getKey({ rowId, columnId })
    this.#map.set(key, payload)
  }

  static get({ rowId, columnId }: { rowId: string; columnId: string }) {
    const key = this.#getKey({ rowId, columnId })
    return this.#map.get(key)
  }
}

export const RatingCellRenderer: CellRenderer = {
  render: (ctx: CanvasRenderingContext2D, props: CellRendererOptions) => {
    const { value, x, y, width, height, column, spriteLoader, padding, mousePosition, row } = props

    const ratingMeta = {
      color: '#fcb401',
      max: 5,
      ...parseProp(column?.meta),
      icon: extractRatingIcon(parseProp(column?.meta)),
    }

    const rating = Math.min(Math.max(0, Number(value) || 0), ratingMeta.max)

    const iconSize = 14
    const iconSpacing = 1.5
    const rowSpacing = 2
    const availableWidth = width - padding * 2

    const iconWidthWithSpacing = iconSize + iconSpacing
    const iconsPerRow = Math.floor(availableWidth / iconWidthWithSpacing)

    if (iconsPerRow < 1) return

    const maxRows = Math.floor((height - padding) / (iconSize + rowSpacing))
    const totalPossibleIcons = iconsPerRow * maxRows

    const iconsToShow = Math.min(totalPossibleIcons, ratingMeta.max)
    const needsEllipsis = iconsToShow < ratingMeta.max

    const startX = x + padding
    const startY = y + padding

    let hoveredIconIndex = -1
    if (mousePosition) {
      const { x: mouseX, y: mouseY } = mousePosition
      const relativeX = mouseX - startX
      const relativeY = mouseY - startY

      const hoveredRow = Math.floor(relativeY / (iconSize + rowSpacing))
      const hoveredCol = Math.floor(relativeX / iconWidthWithSpacing)

      if (
        hoveredRow >= 0 &&
        hoveredRow < maxRows &&
        hoveredCol >= 0 &&
        hoveredCol < iconsPerRow &&
        relativeX >= 0 &&
        relativeY >= 0 &&
        mouseX < x + width &&
        mouseY < y + height
      ) {
        hoveredIconIndex = hoveredRow * iconsPerRow + hoveredCol
        if (hoveredIconIndex >= iconsToShow) {
          hoveredIconIndex = -1
        }
      }
    }

    const iconsData: Position[] = []

    for (let i = 0; i < iconsToShow; i++) {
      const row = Math.floor(i / iconsPerRow)
      const col = i % iconsPerRow
      const isActive = i < rating
      const isHovered = hoveredIconIndex >= 0 && i <= hoveredIconIndex

      let iconColor
      if (isHovered || isActive) {
        iconColor = ratingMeta.color
      } else {
        iconColor = '#d9d9d9'
      }

      if (row < maxRows) {
        const x = startX + col * iconWidthWithSpacing
        const y = startY + row * (iconSize + rowSpacing)
        iconsData.push({ x, y })

        spriteLoader.renderIcon(ctx, {
          icon: isActive || isHovered ? ratingMeta.icon.full : ratingMeta.icon.empty,
          size: iconSize,
          x,
          y,
          color: iconColor,
        })
      }
    }

    RatingPayloadRegistry.set(
      { rowId: row.Id, columnId: column.id! },
      {
        iconsData,
        iconSize,
      },
    )

    if (needsEllipsis && maxRows > 0) {
      const lastRow = Math.min(Math.floor((iconsToShow - 1) / iconsPerRow), maxRows - 1)
      const lastColInRow = (iconsToShow - 1) % iconsPerRow

      ctx.font = '500 13px Manrope'
      ctx.fillStyle = '#4a5268'
      ctx.textBaseline = 'middle'
      ctx.fillText(
        '...',
        startX + (lastColInRow + 1) * iconWidthWithSpacing,
        startY + lastRow * (iconSize + rowSpacing) + iconSize / 2,
      )
    }
  },
  async handleClick({ mousePosition, column, row }) {
    if (!row || !column) return
    const data = RatingPayloadRegistry.get({ rowId: row.row.Id, columnId: column.id! })
    if (!data) return
    const { iconSize, iconsData } = data
    const { x: mouseX, y: mouseY } = mousePosition

    const iconIdx = iconsData.findIndex(({ x, y }) => {
      return mouseX >= x && mouseX <= x + iconSize && mouseY >= y && mouseY <= y + iconSize
    })
    if (iconIdx === -1) return
    console.log(iconIdx + 1) // TODO: Save
  },
}
