import type { ColumnType } from 'nocodb-sdk'
import { renderTag } from '../utils/canvas'

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
    const {
      value,
      x,
      y,
      width,
      height,
      column,
      spriteLoader,
      padding,
      mousePosition,
      readonly,
      tag = {},
      setCursor,
      cellRenderStore,
    } = props

    const {
      renderAsTag,
      tagPaddingX = 6,
      tagHeight = 20,
      tagRadius = 6,
      tagBgColor = '#f4f4f0',
      tagSpacing = 4,
      tagBorderColor,
      tagBorderWidth,
    } = tag

    const iconsData = getIconsData({ height, width, x, y, column, padding })!
    if (!iconsData) return
    const { ratingMeta, startX, startY, iconSize, rowSpacing, iconWidthWithSpacing, maxRows, iconsPerRow, iconsToShow } =
      iconsData

    const rating = Math.min(Math.max(0, Number(value) || 0), ratingMeta.max)

    const needsEllipsis = iconsToShow < ratingMeta.max

    let hoveredIconIndex = -1
    if (mousePosition && !readonly) {
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

    const tagWidth = iconWidthWithSpacing * iconsToShow + tagPaddingX * 2 + (needsEllipsis ? 15 : 0)
    if (renderAsTag) {
      const initialY = y + height / 2 - tagHeight / 2

      renderTag(ctx, {
        x: x + tagSpacing,
        y: initialY,
        width: tagWidth,
        height: tagHeight,
        radius: tagRadius,
        fillStyle: tagBgColor,
        borderColor: tagBorderColor,
        borderWidth: tagBorderWidth,
      })
    }

    for (let i = 0; i < iconsToShow; i++) {
      const row = Math.floor(i / iconsPerRow)
      const col = i % iconsPerRow
      const isActive = i < rating
      let isHovered = hoveredIconIndex >= 0 && i <= hoveredIconIndex

      if (cellRenderStore && cellRenderStore.ratingChanged) {
        const { value, hoverValue } = cellRenderStore.ratingChanged

        if (hoveredIconIndex === hoverValue - 1) {
          isHovered = i + 1 <= value
        } else {
          cellRenderStore.ratingChanged = undefined
        }
      }

      let iconColor

      if (isHovered) {
        iconColor = ratingMeta.color
        if (!readonly) {
          setCursor('pointer')
        }
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

    if (renderAsTag) {
      return {
        x: x + tagWidth + tagSpacing,
        y: y + tagHeight + tagSpacing,
      }
    }
  },
  async handleClick({ mousePosition, column, row, getCellPosition, updateOrSaveRow, value, cellRenderStore, readonly }) {
    if (!row || !column || readonly) return false

    const { x, y, width, height } = getCellPosition(column, row.rowMeta.rowIndex!)
    const iconsData = getIconsData({ x, y, width, height, column: column.columnObj, padding: 10 })

    if (!iconsData) return false
    const { iconSize, iconPositions } = iconsData
    const { x: mouseX, y: mouseY } = mousePosition

    const iconIdx = iconPositions.findIndex(({ iconX, iconY }) => {
      return mouseX >= iconX && mouseX <= iconX + iconSize && mouseY >= iconY && mouseY <= iconY + iconSize
    })
    if (iconIdx === -1) return false

    if (iconIdx + 1 === value) {
      row.row[column.title] = 0
      await updateOrSaveRow?.(row, column.title)

      cellRenderStore.ratingChanged = {
        value: 0,
        hoverValue: iconIdx + 1,
      }

      return true
    }

    row.row[column.title] = iconIdx + 1
    await updateOrSaveRow?.(row, column.title)

    cellRenderStore.ratingChanged = {
      value: iconIdx + 1,
      hoverValue: iconIdx + 1,
    }

    return true
  },

  async handleKeyDown(ctx) {
    const { e, row, column, updateOrSaveRow, readonly } = ctx
    if (column.readonly || readonly) return
    const columnObj = column.columnObj

    if (/^[0-9]$/.test(e.key)) {
      row.row[columnObj.title!] = Number(e.key)
      await updateOrSaveRow(row, columnObj.title)
      return true
    }

    return false
  },
}
