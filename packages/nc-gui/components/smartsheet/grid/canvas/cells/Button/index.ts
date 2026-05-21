import { ButtonActionsType, type ButtonType } from 'nocodb-sdk'
import { defaultOffscreen2DContext, isBoxHovered, renderIconButton, renderSpinner, truncateText } from '../../utils/canvas'

const horizontalPadding = 12
const buttonHeight = 24
const buttonMinWidth = 32

const iconSize = 14
const iconSpacing = 6

const copyIconSize = 20
const copyIconMargin = 4

// Computes button + optional copy-icon positions for a Button cell. Shared between render,
// handleClick, and handleHover so all three agree on where the boxes live. Icon space is
// always reserved for OpenForm — the icon itself is only rendered on row hover, but the
// button's position doesn't shift because of it.
function computeButtonLayout(
  opts: {
    x: number
    y: number
    width: number
    colOptions: ButtonType
  },
) {
  const { x, y, width, colOptions } = opts

  const hasIcon = !!colOptions.icon
  const hasLabel = !!colOptions.label
  const isOpenForm = colOptions.type === ButtonActionsType.OpenForm

  const maxButtonWidth = width - 8 - (isOpenForm ? copyIconSize + copyIconMargin : 0)

  let contentWidth = 0

  if (hasLabel) {
    const ctx = defaultOffscreen2DContext
    ctx.font = '600 13px Inter'
    const maxTextWidth = maxButtonWidth - horizontalPadding * 2 - (hasIcon ? iconSize + iconSpacing : 0)
    const { width: labelWidth } = truncateText(ctx, colOptions.label!, maxTextWidth, true)
    contentWidth += labelWidth
  }
  if (hasIcon) {
    contentWidth += iconSize
    if (hasLabel) contentWidth += iconSpacing
  }

  const buttonWidth = Math.min(maxButtonWidth, Math.max(buttonMinWidth, contentWidth + horizontalPadding * 2))
  const groupWidth = buttonWidth + (isOpenForm ? copyIconMargin + copyIconSize : 0)
  const buttonX = x + (width - groupWidth) / 2
  const buttonY = y + 4

  return {
    buttonX,
    buttonY,
    buttonWidth,
    copyIconRect: isOpenForm
      ? {
          x: buttonX + buttonWidth + copyIconMargin,
          y: buttonY + (buttonHeight - copyIconSize) / 2,
          width: copyIconSize,
          height: copyIconSize,
        }
      : null,
  }
}

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
      rowMeta,
      getColor,
    } = props

    const isQueued = actionManager.isQueued(pk, column.id!)

    const isLoading = actionManager.isLoading(pk, column.id!)
    const afterActionStatus = actionManager.getAfterActionStatus(pk, column.id!)

    const colOptions = column.colOptions as ButtonType
    const filterDisabled = !!rowMeta?.buttonDisabled?.[column.id!]

    cellRenderStore.filterDisabled = filterDisabled
    cellRenderStore.invalidUrlTooltip = afterActionStatus?.tooltip
      ? afterActionStatus.tooltip
      : filterDisabled
      ? t('msg.buttonConditionNotMet')
      : ''

    let disabledState = isLoading || disabled?.isInvalid || isQueued || filterDisabled
    ctx.textAlign = 'left'

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

      const urlInvalid = !(
        url &&
        isValidURL(url, {
          require_tld: !allowLocalUrl,
        })
      )

      disabledState = disabledState || urlInvalid

      if (urlInvalid) {
        cellRenderStore.invalidUrlTooltip = t('msg.error.invalidURL')
      }
    }

    const hasIcon = !!buttonMeta.icon || isLoading || afterActionStatus
    const hasLabel = !!buttonMeta.label

    const isOpenForm = buttonMeta.type === ButtonActionsType.OpenForm

    // Show step title when loading, otherwise show button label
    const currentStepTitle = isLoading ? actionManager.getCurrentStepTitle(pk, column.id!) : undefined
    let truncatedLabel = currentStepTitle || buttonMeta.label

    // computeButtonLayout truncates the label based on the button type; when a step title is
    // showing we need to truncate that string instead, but it still uses the same max width.
    const layout = computeButtonLayout({
      x,
      y,
      width,
      colOptions: {
        ...colOptions,
        label: currentStepTitle || buttonMeta.label,
        type: buttonMeta.type,
      },
    })
    const { buttonX: startX, buttonY: startY, buttonWidth, copyIconRect } = layout

    // Recompute the displayed truncated label using the same effective max width.
    let contentWidth = 0
    if (hasLabel || currentStepTitle) {
      ctx.font = '600 13px Inter'
      const maxTextWidth = buttonWidth - horizontalPadding * 2 - (hasIcon ? iconSize + iconSpacing : 0)
      const truncatedInfo = truncateText(ctx, currentStepTitle || buttonMeta.label, maxTextWidth, true)
      truncatedLabel = truncatedInfo.text
      contentWidth += truncatedInfo.width
    }
    if (hasIcon) {
      contentWidth += iconSize
      if (hasLabel) contentWidth += iconSpacing
    }

    const isHovered =
      !disabledState &&
      mousePosition &&
      mousePosition.x >= startX &&
      mousePosition.x <= startX + buttonWidth &&
      mousePosition.y >= startY &&
      mousePosition.y <= startY + buttonHeight

    const colors = getButtonColors(buttonMeta.theme, buttonMeta.color, isHovered, !!disabledState, getColor)

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

    // OpenForm: icon-only copy button adjacent to the main button, shown on row hover
    if (isOpenForm && props.isRowHovered && copyIconRect) {
      renderIconButton(ctx, {
        buttonX: copyIconRect.x,
        buttonY: copyIconRect.y,
        buttonSize: copyIconSize,
        borderRadius: 6,
        iconData: {
          size: 12,
          xOffset: 4,
          yOffset: 4,
          color: getColor(themeV4Colors.gray['700']),
        },
        mousePosition,
        spriteLoader,
        icon: 'ncCopy',
        background: getColor(themeV4Colors.base.white),
        borderColor: getColor(themeV4Colors.gray['200']),
        hoveredBackground: getColor(themeV4Colors.gray['100']),
        setCursor: props.setCursor,
      })
    }
  },
  async handleClick({ mousePosition, column, row, pk, actionManager, getCellPosition, path, allowLocalUrl, cellRenderStore, t }) {
    const isLoading = actionManager.isLoading(pk, column.id!)

    if (!row || !column?.id || !mousePosition || column?.isInvalidColumn?.isInvalid || isLoading) return false

    if (cellRenderStore?.filterDisabled) return false

    const { x, y, width } = getCellPosition(column, row.rowMeta.rowIndex!)

    const colOptions = column?.columnObj?.colOptions as ButtonType
    if (!colOptions) return false

    const { buttonX, buttonY, buttonWidth, copyIconRect } = computeButtonLayout({ x, y, width, colOptions })

    // Copy-form-URL icon (OpenForm only)
    if (copyIconRect && isBoxHovered(copyIconRect, mousePosition)) {
      try {
        const url = await actionManager.resolveFormEditUrl(column.columnObj.id!, pk)
        if (!url) throw new Error('Could not resolve form URL')
        await navigator.clipboard.writeText(url)
        message.toast(t('msg.info.copiedToClipboard'))
      } catch (e: any) {
        message.error(e?.message || t('msg.error.copyToClipboardError'))
      }
      return true
    }

    if (!isBoxHovered({ x: buttonX, y: buttonY, width: buttonWidth, height: buttonHeight }, mousePosition)) return false

    await actionManager.executeButtonAction([pk], column, { row: [row], path, allowLocalUrl })
    return true
  },

  async handleHover({ column, getCellPosition, row, mousePosition, cellRenderStore, t }) {
    const { tryShowTooltip, hideTooltip } = useTooltipStore()
    hideTooltip()

    const { x, y, width } = getCellPosition(column, row.rowMeta.rowIndex!)

    const colOptions = column.columnObj?.colOptions as ButtonType | undefined
    if (!colOptions || !colOptions.type) return

    const { buttonX, buttonY, buttonWidth, copyIconRect } = computeButtonLayout({ x, y, width, colOptions })

    // Copy-form-URL icon tooltip (OpenForm only)
    if (copyIconRect && mousePosition && isBoxHovered(copyIconRect, mousePosition)) {
      tryShowTooltip({ rect: copyIconRect, mousePosition, text: t('activity.copyUrl') })
      return
    }

    const isInvalid = column?.isInvalidColumn?.isInvalid
    const ignoreTooltip = column?.isInvalidColumn?.ignoreTooltip

    if (!cellRenderStore.invalidUrlTooltip && !cellRenderStore?.filterDisabled && (!isInvalid || ignoreTooltip)) return

    if (!colOptions.label && !cellRenderStore?.filterDisabled) return

    let tooltip = ''
    if (cellRenderStore.invalidUrlTooltip) {
      tooltip = cellRenderStore.invalidUrlTooltip
    } else if (isAiButton(column.columnObj)) {
      tooltip = column?.isInvalidColumn?.tooltip ?? ''
    }

    if (!tooltip) return

    tryShowTooltip({ rect: { x: buttonX, y: buttonY, height: buttonHeight, width: buttonWidth }, mousePosition, text: tooltip })
  },
  async handleKeyDown(ctx) {
    const { e, row, column, actionManager, pk, path, allowLocalUrl, cellRenderStore } = ctx
    if (e.key === 'Enter') {
      const isLoading = actionManager.isLoading(pk, column.id!)

      if (column.readonly || column.columnObj?.readonly || isLoading) return false

      if (cellRenderStore?.filterDisabled) return false

      await actionManager.executeButtonAction([pk], column, { row: [row], path, allowLocalUrl })
      return true
    }

    return false
  },
}
