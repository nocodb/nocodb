import { defaultOffscreen2DContext, truncateText } from '../../utils/canvas'

const horizontalPadding = 8
const pillHeight = 24
const iconSize = 14
const iconSpacing = 4

export const DocCellRenderer: CellRenderer = {
  render: (ctx: CanvasRenderingContext2D, props: CellRendererOptions) => {
    const { x, y, width, mousePosition, spriteLoader, setCursor, getColor, t } = props

    const label = t('general.open')
    const brandColor = getColor(themeV4Colors.brand['500'])
    const bgBase = getColor(themeV4Colors.brand['50'])
    const bgHover = getColor(themeV4Colors.brand['100'])

    const maxPillWidth = width - 8

    ctx.font = '500 13px Inter'
    const truncatedInfo = truncateText(ctx, label, maxPillWidth - horizontalPadding * 2 - iconSize - iconSpacing, true)
    const labelWidth = truncatedInfo.width

    const contentWidth = iconSize + iconSpacing + labelWidth
    const pillWidth = Math.min(maxPillWidth, contentWidth + horizontalPadding * 2)

    const startX = x + (width - pillWidth) / 2
    const startY = y + 4

    const isHovered =
      mousePosition &&
      mousePosition.x >= startX &&
      mousePosition.x <= startX + pillWidth &&
      mousePosition.y >= startY &&
      mousePosition.y <= startY + pillHeight

    // Background
    ctx.beginPath()
    ctx.roundRect(startX, startY, pillWidth, pillHeight, 6)
    ctx.fillStyle = isHovered ? bgHover : bgBase
    ctx.fill()

    let contentX = startX + (pillWidth - contentWidth) / 2
    const contentY = startY + (pillHeight - iconSize) / 2

    // Icon
    spriteLoader.renderIcon(ctx, {
      icon: 'ncFileText',
      size: iconSize,
      x: contentX,
      y: contentY,
      color: brandColor,
    })
    contentX += iconSize + iconSpacing

    // Label
    ctx.fillStyle = brandColor
    ctx.textBaseline = 'middle'
    ctx.fillText(truncatedInfo.text, contentX, startY + 12)

    if (isHovered) setCursor('pointer')
  },

  async handleClick({ mousePosition, column, row, getCellPosition, pk, openDocField, t }) {
    if (!row || !column?.id || !mousePosition) return false

    const { x, y, width } = getCellPosition(column, row.rowMeta.rowIndex!)

    const label = t('general.open')
    const maxPillWidth = width - 8

    const ctx = defaultOffscreen2DContext
    ctx.font = '500 13px Inter'
    const truncatedInfo = truncateText(ctx, label, maxPillWidth - horizontalPadding * 2 - iconSize - iconSpacing, true)
    const contentWidth = iconSize + iconSpacing + truncatedInfo.width
    const pillWidth = Math.min(maxPillWidth, contentWidth + horizontalPadding * 2)

    const startX = x + (width - pillWidth) / 2
    const startY = y + 4

    const isHovered =
      mousePosition.x >= startX &&
      mousePosition.x <= startX + pillWidth &&
      mousePosition.y >= startY &&
      mousePosition.y <= startY + pillHeight

    if (!isHovered) return false

    if (openDocField && column.columnObj?.id && pk) {
      await openDocField(String(pk), column.columnObj.id)
    }
    return true
  },

  async handleKeyDown(ctx) {
    if (ctx.e.key === 'Enter') {
      if (ctx.openDocField && ctx.column?.columnObj?.id && ctx.pk) {
        await ctx.openDocField(String(ctx.pk), ctx.column.columnObj.id)
      }
      return true
    }
    return false
  },
}
