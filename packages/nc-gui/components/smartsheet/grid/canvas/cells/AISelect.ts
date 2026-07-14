import { defaultOffscreen2DContext, isBoxHovered, renderSpinner, truncateText } from '../utils/canvas'
import { getButtonColors } from '~/utils/buttonUtils'

const BUTTON_LABEL = 'Run Agent'
const BUTTON_LABEL_LOADING = 'Running...'

const getFieldAgentButtonDimensions = ({
  ctx,
  width,
  label = BUTTON_LABEL,
  hasIcon,
}: {
  ctx?: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
  width: number
  label?: string
  hasIcon?: boolean
}) => {
  if (!ctx) {
    ctx = defaultOffscreen2DContext
  }

  const horizontalPadding = 12
  const buttonHeight = 24
  const buttonMinWidth = 32
  const iconSize = 14
  const iconSpacing = 6
  const maxButtonWidth = width - 8

  let contentWidth = 0

  ctx.font = '500 13px Inter'
  const maxTextWidth = maxButtonWidth - horizontalPadding * 2 - (hasIcon ? iconSize + iconSpacing : 0)
  const truncatedInfo = truncateText(ctx, label, maxTextWidth, true)
  const truncatedLabel = truncatedInfo.text
  const labelWidth = truncatedInfo.width
  contentWidth += labelWidth

  if (hasIcon) {
    contentWidth += iconSize
    contentWidth += iconSpacing
  }

  const buttonWidth = Math.min(maxButtonWidth, Math.max(buttonMinWidth, contentWidth + horizontalPadding * 2))

  return {
    buttonWidth,
    buttonHeight,
    contentWidth,
    truncatedLabel,
    iconSize,
    iconSpacing,
    horizontalPadding,
  }
}

const renderFieldAgentButton = (
  ctx: CanvasRenderingContext2D,
  {
    x,
    y,
    width,
    disabled,
    mousePosition,
    spriteLoader,
    loadingStartTime,
    isLoading,
    setCursor,
    isDark,
  }: {
    x: number
    y: number
    width: number
    isLoading?: boolean
    disabled?: boolean
    mousePosition?: { x: number; y: number }
    spriteLoader?: any
    loadingStartTime?: number
    setCursor: SetCursorType
    isDark?: boolean
  },
) => {
  const dims = getFieldAgentButtonDimensions({
    ctx,
    width,
    hasIcon: true,
    label: isLoading ? BUTTON_LABEL_LOADING : BUTTON_LABEL,
  })
  const startX = x + (width - dims.buttonWidth) / 2
  const startY = y + 4

  disabled = disabled || isLoading

  const isHovered =
    !disabled &&
    mousePosition &&
    mousePosition.x >= startX &&
    mousePosition.x <= startX + dims.buttonWidth &&
    mousePosition.y >= startY &&
    mousePosition.y <= startY + dims.buttonHeight

  if (isHovered) setCursor('pointer')

  ctx.font = '500 13px Inter'

  if (disabled) {
    ctx.globalAlpha = 0.5
  }

  const colors = isDark
    ? {
        background: isHovered && !disabled ? 'rgba(125, 38, 205, 0.15)' : 'transparent',
        text: disabled ? '#6A7184' : '#B583E0',
        loader: '#B583E0',
      }
    : getButtonColors('light', 'purple', !!isHovered, !!disabled)

  // Draw button background
  ctx.beginPath()
  ctx.roundRect(startX, startY, dims.buttonWidth, dims.buttonHeight, 6)
  ctx.fillStyle = colors.background
  ctx.fill()

  let contentX = startX + (dims.buttonWidth - dims.contentWidth) / 2
  const contentY = startY + (dims.buttonHeight - dims.iconSize) / 2

  if (isLoading && loadingStartTime) {
    renderSpinner(ctx, contentX, contentY, dims.iconSize, colors.loader, loadingStartTime, 1.5)
    contentX += dims.iconSize + dims.iconSpacing
  } else if (spriteLoader) {
    spriteLoader.renderIcon(ctx, {
      icon: 'ncAutoAwesome',
      size: dims.iconSize,
      x: contentX,
      y: contentY,
      color: colors.text,
    })
    contentX += dims.iconSize + dims.iconSpacing
  }

  ctx.fillStyle = colors.text
  ctx.textBaseline = 'middle'
  ctx.fillText(dims.truncatedLabel, contentX, startY + 13)

  if (disabled) {
    ctx.globalAlpha = 1
  }

  return {
    buttonBounds: {
      x: startX,
      y: startY,
      width: dims.buttonWidth,
      height: dims.buttonHeight,
    },
  }
}

export const AISelectCellRenderer: CellRenderer = {
  render: (ctx: CanvasRenderingContext2D, props) => {
    const { x, y, width, spriteLoader, disabled, mousePosition, actionManager, pk, column, setCursor, readonly, isDark } = props

    const horizontalPadding = 12
    const isReadonlyCol = !!(readonly || column.readonly)

    const buttonDisabled = disabled?.isInvalid || isReadonlyCol

    const btnWidth = width - horizontalPadding * 2

    const isLoading = actionManager.isLoading(pk, column.id!)
    const startTime = actionManager.getLoadingStartTime(pk, column.id!)

    const { buttonBounds } = renderFieldAgentButton(ctx, {
      x: x + (width - btnWidth) / 2,
      y,
      width: btnWidth,
      disabled: buttonDisabled,
      mousePosition,
      spriteLoader,
      isLoading,
      loadingStartTime: startTime!,
      setCursor,
      isDark,
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

    const { buttonWidth } = getFieldAgentButtonDimensions({
      width,
      hasIcon: true,
    })

    const buttonBounds = {
      x: x + (width - buttonWidth) / 2,
      y: y + 4,
      width: buttonWidth,
      height: 24,
    }

    if (isBoxHovered(buttonBounds, mousePosition)) {
      await actionManager.executeButtonAction([pk], column, { row: [row], isAiPromptCol: true, path })
      return true
    }

    return false
  },

  async handleKeyDown({ e, column, row, pk, actionManager, path }) {
    if (column.readonly || column?.columnObj?.readonly) return false

    if (e.key === 'Enter') {
      actionManager.executeButtonAction([pk], column, { row: [row], isAiPromptCol: true, path })
      return true
    }

    return false
  },
}
