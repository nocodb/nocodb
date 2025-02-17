export const RatingCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const { value, x, y, width, height, column, spriteLoader } = props
    const padding = 10
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

    for (let i = 0; i < iconsToShow; i++) {
      const row = Math.floor(i / iconsPerRow)
      const col = i % iconsPerRow
      const isActive = i < rating

      if (row < maxRows) {
        spriteLoader.renderIcon(ctx, {
          icon: isActive ? ratingMeta.icon.full : ratingMeta.icon.empty,
          size: iconSize,
          x: startX + col * iconWidthWithSpacing,
          y: startY + row * (iconSize + rowSpacing),
          color: isActive ? ratingMeta.color : '#d9d9d9',
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
        startY + lastRow * (iconSize + rowSpacing) + iconSize / 2
      )
    }
  },
}