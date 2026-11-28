import { defaultOffscreen2DContext, isBoxHovered, renderSpinner, truncateText } from '../utils/canvas'
import { getI18n } from '~/plugins/a.i18n'

/** Resolved per call — the i18n plugin is not ready at module evaluation time. */
const buttonLabel = (isLoading?: boolean) => {
  const { t } = getI18n().global

  return isLoading ? t('general.generating') : t('labels.fieldAgent.runAgent')
}

const BUTTON_FONT = '500 12px Inter'

const getFieldAgentButtonDimensions = ({
  ctx,
  width,
  label = buttonLabel(),
}: {
  ctx?: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
  width: number
  label?: string
}) => {
  if (!ctx) {
    ctx = defaultOffscreen2DContext
  }

  const horizontalPadding = 8
  const buttonHeight = 24
  const iconSize = 12
  const iconSpacing = 6
  const maxButtonWidth = width

  ctx.font = BUTTON_FONT
  const maxTextWidth = maxButtonWidth - horizontalPadding * 2 - iconSize - iconSpacing
  const truncatedInfo = truncateText(ctx, label, maxTextWidth, true)

  const contentWidth = iconSize + iconSpacing + truncatedInfo.width
  const buttonWidth = Math.min(maxButtonWidth, contentWidth + horizontalPadding * 2)

  return {
    buttonWidth,
    buttonHeight,
    contentWidth,
    truncatedLabel: truncatedInfo.text,
    iconSize,
    iconSpacing,
    horizontalPadding,
  }
}

/**
 * Where the Run Agent button sits inside a cell. Both the renderer and the click
 * handler go through this, so the hit box can never drift from what is drawn —
 * the label width feeds into it, and the label changes while running.
 */
const getFieldAgentButtonBounds = ({
  ctx,
  x,
  y,
  width,
  isLoading,
}: {
  ctx?: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
  x: number
  y: number
  width: number
  isLoading?: boolean
}) => {
  // Left-aligned so the icon lines up with text in neighbouring cells
  const inset = 4

  const dims = getFieldAgentButtonDimensions({
    ctx,
    width: width - inset * 2,
    label: buttonLabel(isLoading),
  })

  return {
    x: x + inset,
    y: y + 4,
    width: dims.buttonWidth,
    height: dims.buttonHeight,
    dims,
  }
}

/** Solid play triangle, drawn directly — the sprite's play icons are outline-only. */
const renderPlayIcon = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) => {
  const w = size * 0.75
  const left = x + (size - w) / 2

  ctx.save()
  ctx.fillStyle = color
  ctx.strokeStyle = color
  ctx.lineJoin = 'round'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(left, y + 1)
  ctx.lineTo(left + w, y + size / 2)
  ctx.lineTo(left, y + size - 1)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

const renderFieldAgentButton = (
  ctx: CanvasRenderingContext2D,
  {
    x,
    y,
    width,
    disabled,
    mousePosition,
    loadingStartTime,
    isLoading,
    setCursor,
    getColor,
  }: {
    x: number
    y: number
    width: number
    isLoading?: boolean
    disabled?: boolean
    mousePosition?: { x: number; y: number }
    loadingStartTime?: number
    setCursor: SetCursorType
    getColor: GetColorType
  },
) => {
  const bounds = getFieldAgentButtonBounds({ ctx, x, y, width, isLoading })
  const { dims } = bounds

  disabled = disabled || isLoading

  const isHovered = !disabled && !!mousePosition && isBoxHovered(bounds, mousePosition)

  if (isHovered) setCursor('pointer')

  // Hover: white raised card, AI-purple content (nc-content-purple-dark)
  const contentColor = isHovered ? getColor(themeV4Colors.purple['700']) : getColor(themeV4Colors.gray['800'])

  if (disabled) {
    ctx.globalAlpha = 0.5
  }

  // Plain text at rest; a raised card on hover
  if (isHovered) {
    ctx.save()
    ctx.shadowColor = 'rgba(0, 0, 0, 0.08)'
    ctx.shadowBlur = 3
    ctx.shadowOffsetY = 1
    ctx.beginPath()
    ctx.roundRect(bounds.x, bounds.y, bounds.width, bounds.height, 6)
    ctx.fillStyle = getColor(themeV4Colors.base.white)
    ctx.fill()
    ctx.restore()

    ctx.beginPath()
    ctx.roundRect(bounds.x + 0.5, bounds.y + 0.5, bounds.width - 1, bounds.height - 1, 6)
    ctx.strokeStyle = getColor(themeV4Colors.gray['200'])
    ctx.lineWidth = 1
    ctx.stroke()
  }

  let contentX = bounds.x + dims.horizontalPadding
  const iconY = bounds.y + (dims.buttonHeight - dims.iconSize) / 2

  if (isLoading && loadingStartTime) {
    renderSpinner(ctx, contentX, iconY, dims.iconSize, contentColor, loadingStartTime, 1.5)
  } else {
    const glyph = dims.iconSize - 2
    renderPlayIcon(ctx, contentX + 1, iconY + 1, glyph, contentColor)
  }
  contentX += dims.iconSize + dims.iconSpacing

  ctx.font = BUTTON_FONT
  ctx.fillStyle = contentColor
  ctx.textBaseline = 'middle'
  ctx.fillText(dims.truncatedLabel, contentX, bounds.y + dims.buttonHeight / 2)

  if (disabled) {
    ctx.globalAlpha = 1
  }

  return {
    buttonBounds: {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
    },
  }
}

export const AISelectCellRenderer: CellRenderer = {
  render: (ctx: CanvasRenderingContext2D, props) => {
    const { x, y, width, disabled, mousePosition, actionManager, pk, column, setCursor, readonly, getColor } = props

    const isReadonlyCol = !!(readonly || column.readonly)

    const buttonDisabled = disabled?.isInvalid || isReadonlyCol

    const isLoading = actionManager.isLoading(pk, column.id!)
    const startTime = actionManager.getLoadingStartTime(pk, column.id!)

    const { buttonBounds } = renderFieldAgentButton(ctx, {
      x,
      y,
      width,
      disabled: buttonDisabled,
      mousePosition,
      isLoading,
      loadingStartTime: startTime!,
      setCursor,
      getColor,
    })

    return {
      x: buttonBounds.x + buttonBounds.width,
      y: buttonBounds.y + buttonBounds.height,
    }
  },

  async handleClick({ mousePosition, column, row, pk, actionManager, getCellPosition, path }) {
    if (!row || !column?.id || !mousePosition) return false

    const cellPos = getCellPosition(column, row.rowMeta.rowIndex!)
    if (!cellPos) return false

    const { x, y, width } = cellPos

    const isReadOnlyCol = !!(column.readonly || column.columnObj?.readonly)
    if (isReadOnlyCol) return true

    const buttonBounds = getFieldAgentButtonBounds({
      x,
      y,
      width,
      isLoading: actionManager.isLoading(pk, column.id),
    })

    if (isBoxHovered(buttonBounds, mousePosition)) {
      // Gated users would otherwise click a button that silently does nothing
      if (actionManager.showFieldAgentUpgradeIfBlocked()) return true

      await actionManager.executeButtonAction([pk], column, { row: [row], isAiPromptCol: true, path })
      return true
    }

    return false
  },

  async handleKeyDown({ e, column, row, pk, actionManager, path }) {
    if (column.readonly || column?.columnObj?.readonly) return false

    if (e.key === 'Enter') {
      if (actionManager.showFieldAgentUpgradeIfBlocked()) return true

      await actionManager.executeButtonAction([pk], column, { row: [row], isAiPromptCol: true, path })
      return true
    }

    return false
  },
}
