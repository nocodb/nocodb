import { defaultOffscreen2DContext, isBoxHovered, truncateText } from '../../utils/canvas'

const horizontalPadding = 8
const pillHeight = 24
const iconSize = 14
const iconSpacing = 4

function computePill(
  ctx: CanvasRenderingContext2D,
  label: string,
  cellWidth: number,
  cellX: number,
  cellY: number,
) {
  const maxPillWidth = cellWidth - 8

  ctx.font = '500 13px Inter'
  const truncatedInfo = truncateText(ctx, label, maxPillWidth - horizontalPadding * 2 - iconSize - iconSpacing, true)
  const contentWidth = iconSize + iconSpacing + truncatedInfo.width
  const pillWidth = Math.min(maxPillWidth, contentWidth + horizontalPadding * 2)

  const startX = cellX + (cellWidth - pillWidth) / 2
  const startY = cellY + 4

  return { startX, startY, pillWidth, contentWidth, truncatedInfo }
}

export const DocCellRenderer: CellRenderer = {
  render: (ctx: CanvasRenderingContext2D, props: CellRendererOptions) => {
    const { x, y, width, value, selected, mousePosition, spriteLoader, setCursor, getColor, t } = props

    const hasDoc = !!value

    // Empty cell — show "+ New" only when selected
    if (!hasDoc) {
      if (!selected) return

      const grayColor = getColor(themeV4Colors.gray['500'])
      const bgHover = getColor(themeV4Colors.gray['100'])

      const label = t('general.new')
      const pill = computePill(ctx, label, width, x, y)

      const isPillHovered =
        mousePosition &&
        mousePosition.x >= pill.startX &&
        mousePosition.x <= pill.startX + pill.pillWidth &&
        mousePosition.y >= pill.startY &&
        mousePosition.y <= pill.startY + pillHeight

      if (isPillHovered) {
        ctx.beginPath()
        ctx.roundRect(pill.startX, pill.startY, pill.pillWidth, pillHeight, 6)
        ctx.fillStyle = bgHover
        ctx.fill()
      }

      let contentX = pill.startX + (pill.pillWidth - pill.contentWidth) / 2

      // Icon
      spriteLoader.renderIcon(ctx, {
        icon: 'ncPlus',
        size: iconSize,
        x: contentX,
        y: pill.startY + (pillHeight - iconSize) / 2,
        color: grayColor,
      })
      contentX += iconSize + iconSpacing

      ctx.font = '500 13px Inter'
      ctx.fillStyle = grayColor
      ctx.textBaseline = 'middle'
      ctx.fillText(pill.truncatedInfo.text, contentX, pill.startY + 12)

      if (isPillHovered) setCursor('pointer')
      return
    }

    const brandColor = getColor(themeV4Colors.brand['500'])
    const bgHover = getColor(themeV4Colors.brand['50'])

    const label = t('general.open')
    const icon = 'ncFileText'
    const color = brandColor

    const pill = computePill(ctx, label, width, x, y)

    const isPillHovered =
      mousePosition &&
      mousePosition.x >= pill.startX &&
      mousePosition.x <= pill.startX + pill.pillWidth &&
      mousePosition.y >= pill.startY &&
      mousePosition.y <= pill.startY + pillHeight

    // Background — only on hover
    if (isPillHovered) {
      ctx.beginPath()
      ctx.roundRect(pill.startX, pill.startY, pill.pillWidth, pillHeight, 6)
      ctx.fillStyle = bgHover
      ctx.fill()
    }

    let contentX = pill.startX + (pill.pillWidth - pill.contentWidth) / 2
    const contentY = pill.startY + (pillHeight - iconSize) / 2

    // Icon
    spriteLoader.renderIcon(ctx, {
      icon,
      size: iconSize,
      x: contentX,
      y: contentY,
      color,
    })
    contentX += iconSize + iconSpacing

    // Label
    ctx.font = '500 13px Inter'
    ctx.fillStyle = color
    ctx.textBaseline = 'middle'
    ctx.fillText(pill.truncatedInfo.text, contentX, pill.startY + 12)

    if (isPillHovered) setCursor('pointer')
  },

  async handleClick({ mousePosition, column, row, getCellPosition, pk, openDocField, t, value, selected }) {
    if (!row || !column?.id || !mousePosition) return false

    const { x, y, width, height } = getCellPosition(column, row.rowMeta.rowIndex!)

    const hasDoc = !!value
    const isCellHovered = isBoxHovered({ x, y, width, height }, mousePosition)

    if (!isCellHovered) return false

    // Empty cell — first click selects, second click on "+ New" pill creates doc
    if (!hasDoc) {
      if (!selected) return false // Let grid handle selection

      const label = t('general.new')
      const ctx = defaultOffscreen2DContext
      const pill = computePill(ctx, label, width, x, y)

      const isPillHovered =
        mousePosition.x >= pill.startX &&
        mousePosition.x <= pill.startX + pill.pillWidth &&
        mousePosition.y >= pill.startY &&
        mousePosition.y <= pill.startY + pillHeight

      if (!isPillHovered) return false

      if (openDocField && column.columnObj?.id && pk) {
        await openDocField(String(pk), column.columnObj.id, row.row)
      }
      return true
    }

    // Has doc — only respond to pill click
    const label = t('general.open')

    const ctx = defaultOffscreen2DContext
    const pill = computePill(ctx, label, width, x, y)

    const isPillHovered =
      mousePosition.x >= pill.startX &&
      mousePosition.x <= pill.startX + pill.pillWidth &&
      mousePosition.y >= pill.startY &&
      mousePosition.y <= pill.startY + pillHeight

    if (!isPillHovered) return false

    if (openDocField && column.columnObj?.id && pk) {
      await openDocField(String(pk), column.columnObj.id, row.row)
    }
    return true
  },

  async handleKeyDown(ctx) {
    if (ctx.e.key === 'Enter') {
      if (ctx.openDocField && ctx.column?.columnObj?.id && ctx.pk) {
        await ctx.openDocField(String(ctx.pk), ctx.column.columnObj.id, ctx.row?.row)
      }
      return true
    }
    // Delete/Backspace handled by clearCell in useCopyPaste (supports undo)
    return false
  },
}
