import { isBoxHovered } from '../utils/canvas'
import { getButtonDimensions, renderAIButton } from './AILongText'

export const AISelectCellRenderer: CellRenderer = {
  render: (ctx: CanvasRenderingContext2D, props) => {
    const { x, y, width, spriteLoader, disabled, mousePosition, actionManager, pk, column, setCursor, readonly } = props

    const horizontalPadding = 12
    const isReadonlyCol = !!(readonly || column.readonly)

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
      setCursor,
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
