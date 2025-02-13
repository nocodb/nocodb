import type { ColumnType } from 'nocodb-sdk'

function getIconsData({
  width,
  height,
  padding = 10,
  x,
  y,
  column,
}: {
  width: number
  height: number
  padding?: number
  x: number
  y: number
  column?: ColumnType
}) {
  const ratingMeta = {
    color: '#fcb401',
    max: 5,
    ...parseProp(column?.meta),
    icon: extractRatingIcon(parseProp(column?.meta)),
  }

  const iconSize = 14
  const iconSpacing = 1.5
  const rowSpacing = 2
  const availableWidth = width - padding * 2

  const startX = x + padding
  const startY = y + padding

  const iconWidthWithSpacing = iconSize + iconSpacing
  const iconsPerRow = Math.floor(availableWidth / iconWidthWithSpacing)

  if (iconsPerRow < 1) return

  const maxRows = Math.floor((height - padding) / (iconSize + rowSpacing))
  const totalPossibleIcons = iconsPerRow * maxRows

  const iconsToShow = Math.min(totalPossibleIcons, ratingMeta.max)

  const iconPositions: Array<{ iconX: number; iconY: number }> = []
  for (let i = 0; i < iconsToShow; i++) {
    const row = Math.floor(i / iconsPerRow)
    const col = i % iconsPerRow

    const iconX = startX + col * iconWidthWithSpacing
    const iconY = startY + row * (iconSize + rowSpacing)
    iconPositions.push({ iconX, iconY })
  }

  return {
    iconPositions,
    iconSize,
    ratingMeta,
    startX,
    startY,
    rowSpacing,
    iconWidthWithSpacing,
    maxRows,
    iconsPerRow,
    iconsToShow,
  }
}

const inactiveColor = '#d9d9d9'

export const RatingCellRenderer: CellRenderer = {
  render(ctx: CanvasRenderingContext2D, props: CellRendererOptions) {
    const { value, x, y, width, height, column, spriteLoader, padding, mousePosition } = props

    const iconsData = getIconsData({ height, width, x, y, column, padding })!
    if (!iconsData) return
    const { ratingMeta, startX, startY, iconSize, rowSpacing, iconWidthWithSpacing, maxRows, iconsPerRow, iconsToShow } =
      iconsData

    const rating = Math.min(Math.max(0, Number(value) || 0), ratingMeta.max)

    const needsEllipsis = iconsToShow < ratingMeta.max

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

    for (let i = 0; i < iconsToShow; i++) {
      const row = Math.floor(i / iconsPerRow)
      const col = i % iconsPerRow
      const isActive = i < rating
      const isHovered = hoveredIconIndex >= 0 && i <= hoveredIconIndex

      let iconColor

      if (isHovered) {
        iconColor = ratingMeta.color
      } else {
        iconColor = inactiveColor
      }
      if (hoveredIconIndex === -1) iconColor = isActive ? ratingMeta.color : inactiveColor

      if (row < maxRows) {
        const x = startX + col * iconWidthWithSpacing
        const y = startY + row * (iconSize + rowSpacing)

        spriteLoader.renderIcon(ctx, {
          icon: isActive || isHovered ? ratingMeta.icon.full : ratingMeta.icon.empty,
          size: iconSize,
          x,
          y,
          color: iconColor,
        })
      }
    }

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
  async handleClick({ mousePosition, column, row, getCellPosition, updateOrSaveRow }) {
    if (!row || !column) return

    const { x, y, width, height } = getCellPosition(column, row.rowMeta.rowIndex!)
    const iconsData = getIconsData({ x, y, width, height, column: column.columnObj, padding: 10 })

    if (!iconsData) return
    const { iconSize, iconPositions } = iconsData
    const { x: mouseX, y: mouseY } = mousePosition

    const iconIdx = iconPositions.findIndex(({ iconX, iconY }) => {
      return mouseX >= iconX && mouseX <= iconX + iconSize && mouseY >= iconY && mouseY <= iconY + iconSize
    })
    if (iconIdx === -1) return
    row.row[column.title] = iconIdx + 1
    updateOrSaveRow?.(row, column.title)
  },
}
