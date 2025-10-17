import { ButtonActionsType, type ButtonType } from 'nocodb-sdk'
import { defaultOffscreen2DContext, renderSpinner, truncateText } from '../../utils/canvas'
import { getButtonColors } from './utils'

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

    const isQueued = actionManager.isQueued(pk, column.id!)

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

    let disabledState = isLoading || disabled?.isInvalid || isQueued
    ctx.textAlign = 'left'

    const colOptions = column.colOptions as ButtonType
    if (!colOptions) return

    const buttonMeta = {
      label: isQueued ? 'Queued...' : colOptions?.label || '',
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

    // Show step title when loading, otherwise show button label
    const currentStepTitle = isLoading ? actionManager.getCurrentStepTitle(pk, column.id!) : undefined
    let truncatedLabel = currentStepTitle || buttonMeta.label

    if (hasLabel || currentStepTitle) {
      ctx.font = '600 13px Inter'
      const maxTextWidth = maxButtonWidth - horizontalPadding * 2 - (hasIcon ? iconSize + iconSpacing : 0)

      const labelToTruncate = currentStepTitle || buttonMeta.label
      const truncatedInfo = truncateText(ctx, labelToTruncate, maxTextWidth, true)
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

    if (hasLabel || currentStepTitle) {
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
      ctx.font = '600 13px Inter'

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

  async handleHover({ column, getCellPosition, row, mousePosition, cellRenderStore }) {
    const { tryShowTooltip, hideTooltip } = useTooltipStore()
    hideTooltip()

    const { x, y, width } = getCellPosition(column, row.rowMeta.rowIndex!)

    const isInvalid = column?.isInvalidColumn?.isInvalid
    const ignoreTooltip = column?.isInvalidColumn?.ignoreTooltip

    if (!cellRenderStore.invalidUrlTooltip && (!isInvalid || ignoreTooltip)) return

    const colOptions = column.columnObj?.colOptions as ButtonType

    if (!colOptions || !colOptions.type) return

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
      ctx.font = '600 13px Inter'

      const maxTextWidth = maxButtonWidth - horizontalPadding * 2 - (hasIcon ? iconSize + iconSpacing : 0)

      const truncatedInfo = truncateText(ctx, buttonMeta.label, maxTextWidth, true)
      labelWidth = truncatedInfo.width
      contentWidth += labelWidth
    }

    let tooltip = ''

    if (cellRenderStore.invalidUrlTooltip) {
      tooltip = cellRenderStore.invalidUrlTooltip
    } else if (isAiButton(column.columnObj)) {
      tooltip = column?.isInvalidColumn?.tooltip ?? ''
    }

    if (!tooltip) return

    const buttonWidth = Math.min(maxButtonWidth, Math.max(buttonMinWidth, contentWidth + horizontalPadding * 2))

    const startX = x + (width - buttonWidth) / 2
    const startY = y + 4
    const box = { x: startX, y: startY, height: buttonHeight, width: buttonWidth }
    tryShowTooltip({ rect: box, mousePosition, text: tooltip })
  },
  async handleKeyDown(ctx) {
    const { e, row, column, actionManager, pk, path, allowLocalUrl } = ctx
    if (e.key === 'Enter') {
      const isLoading = actionManager.isLoading(pk, column.id!)

      if (column.readonly || column.columnObj?.readonly || isLoading) return false

      await actionManager.executeButtonAction([pk], column, { row: [row], path, allowLocalUrl })
      return true
    }

    return false
  },
}
