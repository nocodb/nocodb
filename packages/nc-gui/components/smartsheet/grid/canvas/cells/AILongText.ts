import { renderMultiLineText, renderSpinner, truncateText } from '../utils/canvas'

const getButtonDimensions = (
  ctx: CanvasRenderingContext2D,
  width: number,
  label: string = 'Generate',
  hasIcon: boolean = true,
) => {
  const horizontalPadding = 12
  const buttonHeight = 24
  const buttonMinWidth = 32
  const iconSize = 14
  const iconSpacing = 6
  const maxButtonWidth = width - 8

  let contentWidth = 0

  ctx.font = '500 13px Manrope'
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
  }: {
    x: number
    y: number
    width: number
    isLoading?: boolean
    disabled?: boolean
    mousePosition?: { x: number; y: number }
    spriteLoader?: any
    loadingStartTime?: number
  },
) => {
  const dims = getButtonDimensions(ctx, width)
  const startX = x + (width - dims.buttonWidth) / 2
  const startY = y + 4

  const isHovered =
    !disabled &&
    mousePosition &&
    mousePosition.x >= startX &&
    mousePosition.x <= startX + dims.buttonWidth &&
    mousePosition.y >= startY &&
    mousePosition.y <= startY + dims.buttonHeight

  const colors = {
    background: disabled ? '#F4F4F5' : isHovered ? '#E5D4F5' : '#F3ECFA',
    text: disabled ? '#9AA2AF' : '#7D26CD',
    loader: '#7D26CD',
  }

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

  return {
    buttonBounds: {
      x: startX,
      y: startY,
      width: dims.buttonWidth,
      height: dims.buttonHeight,
    },
  }
}

export const AILongTextCellRenderer = {
  render: (ctx: CanvasRenderingContext2D, props) => {
    const { value, x, y, width, height, spriteLoader, disabled, padding, mousePosition } = props

    const horizontalPadding = 12

    if (!value) {
      const buttonDisabled = disabled?.isInvalid

      const btnWidth = width - horizontalPadding * 2

      const { buttonBounds } = renderAIButton(ctx, {
        x: x + (width - btnWidth) / 2,
        y,
        width: btnWidth,
        disabled: buttonDisabled,
        mousePosition,
        spriteLoader,
      })

      return {
        x: buttonBounds.x + buttonBounds.width,
        y: buttonBounds.y + buttonBounds.height,
      }
    }

    if (value?.value) {
      const { x: xOffset, y: yOffset } = renderMultiLineText(ctx, {
        x: x + padding,
        y,
        text: value.value,
        maxWidth: width - padding * 2,
        fillStyle: '#4a5268',
        height,
      })

      return {
        x: xOffset,
        y: yOffset,
      }
    }

    return {
      x,
      y,
    }
  },
}
