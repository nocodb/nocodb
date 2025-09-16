import {
  defaultOffscreen2DContext,
  isBoxHovered,
  renderIconButton,
  renderMultiLineText,
  renderSpinner,
  truncateText,
} from '../utils/canvas'
import { getButtonColors } from './Button/utils'

const getButtonDimensions = ({
  ctx,
  width,
  label = 'Generate',
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

const renderAIButton = (
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
  },
) => {
  const dims = getButtonDimensions({
    ctx,
    width,
    hasIcon: true,
    label: isLoading ? 'Generating...' : 'Generate',
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

  ctx.font = '600 13px Inter'

  if (disabled) {
    ctx.globalAlpha = 0.5
  }

  const colors = getButtonColors('light', 'purple', !!isHovered, !!disabled)

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

export const AILongTextCellRenderer: CellRenderer = {
  render: (ctx: CanvasRenderingContext2D, props) => {
    const {
      value,
      x,
      y,
      width,
      height,
      spriteLoader,
      disabled,
      padding,
      mousePosition,
      actionManager,
      pk,
      column,
      setCursor,
      selected,
      readonly,
    } = props

    const horizontalPadding = 12

    const isReadonlyCol = !!(readonly || column.readonly)

    if (!value && !isReadonlyCol) {
      const buttonDisabled = disabled?.isInvalid || isReadonlyCol

      const btnWidth = width - horizontalPadding * 2

      const isLoading = actionManager.isLoading(pk, column.id!)

      const startTime = actionManager.getLoadingStartTime(pk, column.id!)

      const { buttonBounds } = renderAIButton(ctx, {
        x: x + (width - btnWidth) / 2,
        y,
        width: btnWidth,
        disabled: buttonDisabled,
        mousePosition,
        spriteLoader,
        isLoading,
        loadingStartTime: startTime!,
        setCursor: props.setCursor,
      })

      return {
        x: buttonBounds.x + buttonBounds.width,
        y: buttonBounds.y + buttonBounds.height,
      }
    }

    const { x: xOffset, y: yOffset } = renderMultiLineText(ctx, {
      x: x + padding,
      y,
      text: value?.value || '',
      maxWidth: width - padding * 2,
      fillStyle: '#4a5268',
      height,
    })

    if (selected && (!isReadonlyCol || value)) {
      renderIconButton(ctx, {
        buttonX: x + width - 28,
        buttonY: y + 7,
        buttonSize: 20,
        borderRadius: 6,
        iconData: {
          size: 12,
          xOffset: 4,
          yOffset: 4,
        },
        mousePosition,
        spriteLoader,
        icon: 'maximize',
        background: 'white',
        setCursor,
      })

      if (!isReadonlyCol) {
        renderIconButton(ctx, {
          buttonX: x + width - 52,
          buttonY: y + 7,
          buttonSize: 20,
          borderRadius: 6,
          iconData: {
            size: 12,
            xOffset: 4,
            yOffset: 4,
          },
          mousePosition,
          spriteLoader,
          icon: 'refresh',
          background: 'white',
          setCursor,
        })
      }
    }

    return {
      x: xOffset,
      y: yOffset,
    }
  },
  async handleClick({ mousePosition, column, row, value, pk, actionManager, getCellPosition, makeCellEditable, path, selected }) {
    if (!row || !column?.id || !mousePosition) return false

    const { x, y, width } = getCellPosition(column, row.rowMeta.rowIndex!) || column?.isInvalidColumn?.isInvalid

    const expandIconBox = { x: x + width - 28, y: y + 7, width: 20, height: 20 }
    const regenerateIconBox = { x: x + width - 52, y: y + 7, width: 20, height: 20 }

    const isReadOnlyCol = !!(column.readonly || column.columnObj?.readonly)

    if (!value) {
      if (isReadOnlyCol) {
        return true
      }

      const { buttonWidth } = getButtonDimensions({
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
      } else {
        return false
      }
    }

    if (column?.isInvalidColumn?.isInvalid && selected) {
      // If the column is invalid and user clicked on regenerate icon
      if (isBoxHovered(regenerateIconBox, mousePosition)) {
        return true
      }
    }

    if (
      selected &&
      (isBoxHovered(expandIconBox, mousePosition) || (!isReadOnlyCol && isBoxHovered(regenerateIconBox, mousePosition)))
    ) {
      makeCellEditable(row, column)
      return true
    }

    return false
  },
  async handleHover({ row, column, mousePosition, getCellPosition, t, value, selected }) {
    const { tryShowTooltip, hideTooltip } = useTooltipStore()
    hideTooltip()
    if (!row || !column?.id || !mousePosition || column?.isInvalidColumn?.isInvalid || !value || !value?.value || !selected) {
      return
    }

    const { x, y, width } = getCellPosition(column, row.rowMeta.rowIndex!)
    const expandIconBox = { x: x + width - 28, y: y + 7, width: 18, height: 18 }
    const regenerateIconBox = { x: x + width - 52, y: y + 7, width: 18, height: 18 }
    tryShowTooltip({ text: t('title.expand'), rect: expandIconBox, mousePosition })

    if (!column.readonly && !column?.columnObj?.readonly) {
      tryShowTooltip({ text: 'Re-generate', rect: regenerateIconBox, mousePosition })
    }
  },
  async handleKeyDown(ctx) {
    const { e, row, column, makeCellEditable, value, pk, actionManager, path } = ctx

    const columnObj = column?.columnObj

    if (column.readonly || columnObj?.readonly) return false

    if (!value && e.key === 'Enter') {
      actionManager.executeButtonAction([pk], column, { row: [row], isAiPromptCol: true, path })
      return true
    }

    if (isExpandCellKey(e)) {
      // prevent default to avoid adding space to the end of the cell
      e.preventDefault()
    }

    if (e.key.length === 1 && columnObj.title) {
      if (!value && columnObj.title) {
        row.row[columnObj.title] = { value: '' }
      }

      makeCellEditable(row, column)
      return true
    }

    return false
  },
}
