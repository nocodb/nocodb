import { ButtonActionsType, type ButtonType } from 'nocodb-sdk'
import { defaultOffscreen2DContext, renderSpinner, truncateText } from '../utils/canvas'

const buttonColorMap = {
  solid: {
    brand: {
      base: { background: '#3366FF', text: '#FFFFFF' },
      hover: { background: '#2952CC', text: '#FFFFFF' },
      loader: '#3366FF',
      disabled: { background: '#F4F4F5', text: '#9AA2AF' },
    },
    red: {
      base: { background: '#FF4A3F', text: '#FFFFFF' },
      hover: { background: '#CB3F36', text: '#FFFFFF' },
      loader: '#FF4A3F',
      disabled: { background: '#F4F4F5', text: '#9AA2AF' },
    },
    green: {
      base: { background: '#27D665', text: '#FFFFFF' },
      hover: { background: '#1FAB51', text: '#FFFFFF' },
      loader: '#27D665',
      disabled: { background: '#F4F4F5', text: '#9AA2AF' },
    },
    maroon: {
      base: { background: '#B33771', text: '#FFFFFF' },
      hover: { background: '#9D255D', text: '#FFFFFF' },
      loader: '#B33771',
      disabled: { background: '#F4F4F5', text: '#9AA2AF' },
    },
    blue: {
      base: { background: '#36BFFF', text: '#FFFFFF' },
      hover: { background: '#2B99CC', text: '#FFFFFF' },
      loader: '#36BFFF',
      disabled: { background: '#F4F4F5', text: '#9AA2AF' },
    },
    orange: {
      base: { background: '#FA8231', text: '#FFFFFF' },
      hover: { background: '#E1752C', text: '#FFFFFF' },
      loader: '#FA8231',
      disabled: { background: '#F4F4F5', text: '#9AA2AF' },
    },
    pink: {
      base: { background: '#FC3AC6', text: '#FFFFFF' },
      hover: { background: '#CA2E9E', text: '#FFFFFF' },
      loader: '#FC3AC6',
      disabled: { background: '#F4F4F5', text: '#9AA2AF' },
    },
    purple: {
      base: { background: '#7D26CD', text: '#FFFFFF' },
      hover: { background: '#641EA4', text: '#FFFFFF' },
      loader: '#7D26CD',
      disabled: { background: '#F4F4F5', text: '#9AA2AF' },
    },
    yellow: {
      base: { background: '#fcbe3a', text: '#FFFFFF' },
      hover: { background: '#ca982e', text: '#FFFFFF' },
      loader: '#fcbe3a',
      disabled: { background: '#F4F4F5', text: '#9AA2AF' },
    },
    gray: {
      base: { background: '#6A7184', text: '#FFFFFF' },
      hover: { background: '#4A5268', text: '#FFFFFF' },
      loader: '#6A7184',
      disabled: { background: '#F4F4F5', text: '#9AA2AF' },
    },
  },
  light: {
    brand: {
      base: { background: '#EBF0FF', text: '#2952CC' },
      hover: { background: '#D6E0FF', text: '#2952CC' },
      disabled: { background: '#F4F4F5', text: '#9AA2AF' },
      loader: '#2952CC',
    },
    red: {
      base: { background: '#FFF2F1', text: '#E8463C' },
      hover: { background: '#FFDBD9', text: '#E8463C' },
      disabled: { background: '#F4F4F5', text: '#9AA2AF' },
      loader: '#E8463C',
    },
    green: {
      base: { background: '#ECFFF2', text: '#1FAB51' },
      hover: { background: '#D4F7E0', text: '#1FAB51' },
      disabled: { background: '#F4F4F5', text: '#9AA2AF' },
      loader: '#1FAB51',
    },
    maroon: {
      base: { background: '#FFF0F7', text: '#9D255D' },
      hover: { background: '#FFCFE6', text: '#9D255D' },
      disabled: { background: '#F4F4F5', text: '#9AA2AF' },
      loader: '#9D255D',
    },
    blue: {
      base: { background: '#EDF9FF', text: '#2B99CC' },
      hover: { background: '#D7F2FF', text: '#2B99CC' },
      disabled: { background: '#F4F4F5', text: '#9AA2AF' },
      loader: '#2B99CC',
    },
    orange: {
      base: { background: '#FFF5EF', text: '#E1752C' },
      hover: { background: '#FEE6D6', text: '#E1752C' },
      disabled: { background: '#F4F4F5', text: '#9AA2AF' },
      loader: '#E1752C',
    },
    pink: {
      base: { background: '#FFEEFB', text: '#CA2E9E' },
      hover: { background: '#FED8F4', text: '#CA2E9E' },
      disabled: { background: '#F4F4F5', text: '#9AA2AF' },
      loader: '#CA2E9E',
    },
    purple: {
      base: { background: '#F3ECFA', text: '#641EA4' },
      hover: { background: '#E5D4F5', text: '#641EA4' },
      disabled: { background: '#F4F4F5', text: '#9AA2AF' },
      loader: '#641EA4',
    },
    yellow: {
      base: { background: '#fffbf2', text: '#ca982e' },
      hover: { background: '#fff0d1', text: '#ca982e' },
      disabled: { background: '#F4F4F5', text: '#9AA2AF' },
      loader: '#ca982e',
    },
    gray: {
      base: { background: '#F9F9FA', text: '#4A5268' },
      hover: { background: '#F4F4F5', text: '#4A5268' },
      disabled: { background: '#F4F4F5', text: '#9AA2AF' },
      loader: '#4A5268',
    },
  },
  text: {
    brand: {
      base: { background: 'transparent', text: '#3366FF' },
      hover: { background: '#F4F4F5', text: '#3366FF' },
      disabled: { background: '#F4F4F5', text: '#9AA2AF' },
      loader: '#3366FF',
    },
    red: {
      base: { background: 'transparent', text: '#FF4A3F' },
      hover: { background: '#F4F4F5', text: '#FF4A3F' },
      disabled: { background: '#F4F4F5', text: '#9AA2AF' },
      loader: '#FF4A3F',
    },
    green: {
      base: { background: 'transparent', text: '#27D665' },
      hover: { background: '#F4F4F5', text: '#27D665' },
      disabled: { background: '#F4F4F5', text: '#9AA2AF' },
      loader: '#27D665',
    },
    maroon: {
      base: { background: 'transparent', text: '#B33771' },
      hover: { background: '#F4F4F5', text: '#B33771' },
      disabled: { background: '#F4F4F5', text: '#9AA2AF' },
      loader: '#B33771',
    },
    blue: {
      base: { background: 'transparent', text: '#36BFFF' },
      hover: { background: '#F4F4F5', text: '#36BFFF' },
      disabled: { background: '#F4F4F5', text: '#9AA2AF' },
      loader: '#36BFFF',
    },
    orange: {
      base: { background: 'transparent', text: '#FA8231' },
      hover: { background: '#F4F4F5', text: '#FA8231' },
      disabled: { background: '#F4F4F5', text: '#9AA2AF' },

      loader: '#FA8231',
    },
    pink: {
      base: { background: 'transparent', text: '#FC3AC6' },
      hover: { background: '#F4F4F5', text: '#FC3AC6' },
      disabled: { background: '#F4F4F5', text: '#9AA2AF' },
      loader: '#FC3AC6',
    },
    purple: {
      base: { background: 'transparent', text: '#7D26CD' },
      hover: { background: '#F4F4F5', text: '#7D26CD' },
      disabled: { background: '#F4F4F5', text: '#9AA2AF' },
      loader: '#7D26CD',
    },
    yellow: {
      base: { background: 'transparent', text: '#fcbe3a' },
      hover: { background: '#F4F4F5', text: '#fcbe3a' },
      disabled: { background: '#F4F4F5', text: '#9AA2AF' },

      loader: '#fcbe3a',
    },
    gray: {
      base: { background: 'transparent', text: '#6A7184' },
      hover: { background: '#F4F4F5', text: '#6A7184' },
      disabled: { background: '#F4F4F5', text: '#9AA2AF' },
      loader: '#6A7184',
    },
  },
} as const

const getButtonColors = (
  theme: 'solid' | 'light' | 'text',
  color: 'brand' | 'red' | 'green' | 'maroon' | 'blue' | 'orange' | 'pink' | 'purple' | 'yellow' | 'gray',
  isHovered: boolean,
  isDisabled: boolean,
) => {
  const themeColors = buttonColorMap[theme]?.[color]
  if (!themeColors) {
    return isHovered && !isDisabled
      ? { background: '#2952CC', text: '#FFFFFF', loader: '#3366FF' }
      : { background: '#3366FF', text: '#FFFFFF', loader: '#3366FF' }
  }

  const state = isHovered && !isDisabled ? 'hover' : 'base'
  const colors = themeColors[state]

  return {
    ...colors,
    loader: themeColors.loader,
  }
}

const horizontalPadding = 12
const buttonHeight = 24
const buttonMinWidth = 32

const iconSize = 14
const iconSpacing = 6

export const ButtonCellRenderer: CellRenderer = {
  render: (ctx: CanvasRenderingContext2D, props: CellRendererOptions) => {
    const {
      x,
      y,
      width,
      column,
      spriteLoader,
      mousePosition,
      actionManager,
      pk,
      disabled,
      value,
      allowLocalUrl,
      cellRenderStore,
      t,
    } = props
    const isLoading = actionManager.isLoading(pk, column.id!)
    const afterActionStatus = actionManager.getAfterActionStatus(pk, column.id!)

    if (afterActionStatus?.tooltip) {
      Object.assign(cellRenderStore, {
        invalidUrlTooltip: afterActionStatus.tooltip,
      })
    } else {
      Object.assign(cellRenderStore, {
        invalidUrlTooltip: '',
      })
    }

    let disabledState = isLoading || disabled?.isInvalid
    ctx.textAlign = 'left'

    const colOptions = column.colOptions as ButtonType
    if (!colOptions) return

    const buttonMeta = {
      label: colOptions.label || '',
      icon: colOptions.icon,
      theme: colOptions.theme || 'solid',
      color: colOptions.color || 'brand',
      type: colOptions.type,
    }

    if (buttonMeta.type === ButtonActionsType.Url) {
      let url = addMissingUrlSchma(value?.url?.toString() ?? '')

      // if url params not encoded, encode them using encodeURI
      try {
        url = decodeURI(url) === url ? encodeURI(url) : url
      } catch {
        url = encodeURI(url)
      }

      disabledState = !(
        url &&
        isValidURL(url, {
          require_tld: !allowLocalUrl,
        })
      )

      Object.assign(cellRenderStore, {
        invalidUrlTooltip: disabledState ? t('msg.error.invalidURL') : '',
      })
    }

    const hasIcon = !!buttonMeta.icon || isLoading || afterActionStatus
    const hasLabel = !!buttonMeta.label

    const maxButtonWidth = width - 8

    let contentWidth = 0
    let labelWidth = 0
    let truncatedLabel = buttonMeta.label

    if (hasLabel) {
      ctx.font = '550 13px Inter'
      const maxTextWidth = maxButtonWidth - horizontalPadding * 2 - (hasIcon ? iconSize + iconSpacing : 0)

      const truncatedInfo = truncateText(ctx, buttonMeta.label, maxTextWidth, true)
      truncatedLabel = truncatedInfo.text
      labelWidth = truncatedInfo.width
      contentWidth += labelWidth
    }

    if (hasIcon) {
      contentWidth += iconSize
      if (hasLabel) contentWidth += iconSpacing
    }

    const buttonWidth = Math.min(maxButtonWidth, Math.max(buttonMinWidth, contentWidth + horizontalPadding * 2))

    const startX = x + (width - buttonWidth) / 2
    const startY = y + 4

    const isHovered =
      !disabledState &&
      mousePosition &&
      mousePosition.x >= startX &&
      mousePosition.x <= startX + buttonWidth &&
      mousePosition.y >= startY &&
      mousePosition.y <= startY + buttonHeight

    const colors = getButtonColors(buttonMeta.theme, buttonMeta.color, isHovered, !!disabledState)

    if (isHovered) props.setCursor('pointer')

    if (disabledState) {
      ctx.globalAlpha = buttonMeta.theme === 'solid' ? 0.3 : 0.5
    }

    ctx.beginPath()
    ctx.roundRect(startX, startY, buttonWidth, buttonHeight, 6)
    ctx.fillStyle = colors.background
    ctx.fill()

    let contentX = startX + (buttonWidth - contentWidth) / 2
    const contentY = startY + (buttonHeight - iconSize) / 2

    if (!!disabledState && colors.text === '#FFFFFF') {
      ctx.globalAlpha = 1
    }

    if (isLoading) {
      const loadingStartTime = actionManager.getLoadingStartTime(pk, column.id!)
      if (loadingStartTime) {
        renderSpinner(ctx, contentX, contentY, iconSize, colors.loader, loadingStartTime, 1.5)
        contentX += iconSize + (hasLabel ? iconSpacing : 0)
      }
    } else if (afterActionStatus) {
      spriteLoader.renderIcon(ctx, {
        icon: afterActionStatus.status === 'success' ? 'ncCheck' : 'ncInfo',
        size: iconSize,
        x: contentX,
        y: contentY,
        color: colors.text,
      })
      contentX += iconSize + (hasLabel ? iconSpacing : 0)
    } else if (hasIcon) {
      spriteLoader.renderIcon(ctx, {
        icon: buttonMeta.icon,
        size: iconSize,
        x: contentX,
        y: contentY,
        color: colors.text,
      })
      contentX += iconSize + (hasLabel ? iconSpacing : 0)
    }

    if (hasLabel) {
      ctx.fillStyle = colors.text
      ctx.textBaseline = 'middle'
      ctx.fillText(truncatedLabel, contentX, startY + 13)
    }

    if (disabledState) {
      ctx.globalAlpha = 1
    }
  },
  async handleClick({ mousePosition, column, row, pk, actionManager, getCellPosition, path, allowLocalUrl }) {
    const isLoading = actionManager.isLoading(pk, column.id!)

    if (!row || !column?.id || !mousePosition || column?.isInvalidColumn?.isInvalid || isLoading) return false

    const { x, y, width } = getCellPosition(column, row.rowMeta.rowIndex!)

    const colOptions = column?.columnObj?.colOptions as ButtonType

    if (!colOptions) return false

    const buttonMeta = {
      label: colOptions?.label || '',
      icon: colOptions?.icon,
      theme: colOptions?.theme || 'solid',
      color: colOptions?.color || 'brand',
      type: colOptions?.type,
    }

    const hasIcon = !!buttonMeta.icon
    const hasLabel = !!buttonMeta.label

    const maxButtonWidth = width - 8

    let contentWidth = 0
    let labelWidth = 0

    if (hasLabel) {
      const ctx = defaultOffscreen2DContext
      ctx.font = '550 13px Inter'

      const maxTextWidth = maxButtonWidth - horizontalPadding * 2 - (hasIcon ? iconSize + iconSpacing : 0)

      const truncatedInfo = truncateText(ctx, buttonMeta.label, maxTextWidth, true)
      labelWidth = truncatedInfo.width
      contentWidth += labelWidth
    }

    if (hasIcon) {
      contentWidth += iconSize
      if (hasLabel) contentWidth += iconSpacing
    }

    const buttonWidth = Math.min(maxButtonWidth, Math.max(buttonMinWidth, contentWidth + horizontalPadding * 2))

    const startX = x + (width - buttonWidth) / 2
    const startY = y + 4

    const isHovered =
      mousePosition &&
      mousePosition.x >= startX &&
      mousePosition.x <= startX + buttonWidth &&
      mousePosition.y >= startY &&
      mousePosition.y <= startY + buttonHeight

    if (!isHovered) return false
    await actionManager.executeButtonAction([pk], column, { row: [row], path, allowLocalUrl })
    return true
  },

  async handleHover({ column, getCellPosition, row, mousePosition, t, cellRenderStore }) {
    const { tryShowTooltip, hideTooltip } = useTooltipStore()
    hideTooltip()

    const { x, y, width } = getCellPosition(column, row.rowMeta.rowIndex!)

    const isInvalid = column?.isInvalidColumn?.isInvalid
    const ignoreTooltip = column?.isInvalidColumn?.ignoreTooltip

    if (!cellRenderStore.invalidUrlTooltip && (!isInvalid || ignoreTooltip)) return

    const { aiIntegrations } = useNocoAi()

    const colOptions = column.columnObj?.colOptions as ButtonType

    if (!colOptions) return

    const buttonMeta = {
      label: colOptions?.label || '',
      icon: colOptions?.icon,
      theme: colOptions?.theme || 'solid',
      color: colOptions?.color || 'brand',
      type: colOptions?.type,
    }
    const hasIcon = !!buttonMeta.icon
    const hasLabel = !!buttonMeta.label

    if (!hasLabel) return
    let contentWidth = 0
    let labelWidth = 0
    const maxButtonWidth = width - 8

    if (hasLabel) {
      const ctx = defaultOffscreen2DContext
      ctx.font = '550 13px Inter'

      const maxTextWidth = maxButtonWidth - horizontalPadding * 2 - (hasIcon ? iconSize + iconSpacing : 0)

      const truncatedInfo = truncateText(ctx, buttonMeta.label, maxTextWidth, true)
      labelWidth = truncatedInfo.width
      contentWidth += labelWidth
    }

    const tooltip = cellRenderStore.invalidUrlTooltip
      ? cellRenderStore.invalidUrlTooltip
      : aiIntegrations.value.length
      ? t('tooltip.aiIntegrationReConfigure')
      : t('tooltip.aiIntegrationAddAndReConfigure')

    const buttonWidth = Math.min(maxButtonWidth, Math.max(buttonMinWidth, contentWidth + horizontalPadding * 2))

    const startX = x + (width - buttonWidth) / 2
    const startY = y + 4
    const box = { x: startX, y: startY, height: buttonHeight, width: buttonWidth }
    tryShowTooltip({ rect: box, mousePosition, text: tooltip })
  },
  async handleKeyDown(ctx) {
    const { e, row, column, actionManager, pk, path } = ctx
    if (e.key === 'Enter') {
      const isLoading = actionManager.isLoading(pk, column.id!)

      if (column.readonly || column.columnObj?.readonly || isLoading) return false
      await actionManager.executeButtonAction([pk], column, { row: [row], path, allowLocalUrl })
      return true
    }

    return false
  },
}
