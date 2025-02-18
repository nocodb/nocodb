import { isAIPromptCol } from 'nocodb-sdk'
import { isBoxHovered, renderIconButton, renderMarkdown, renderMultiLineText, renderTagLabel } from '../utils/canvas'
import { getI18n } from '../../../../../plugins/a.i18n'
import { AILongTextCellRenderer } from './AILongText'

export const LongTextCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    if (isAIPromptCol(props.column)) {
      AILongTextCellRenderer.render(ctx, props)
      return
    }

    const isRichMode = props.column?.meta?.richMode

    const { value, x, y, width, height, pv, padding, textColor = '#4a5268', mousePosition, spriteLoader, setCursor } = props

    const text = value?.toString() ?? ''

    const isHovered = isBoxHovered({ x, y, width, height }, mousePosition)

    const renderExpandIcon = () => {
      renderIconButton(ctx, {
        buttonX: x + width - 28,
        buttonY: y + 7,
        buttonSize: 20,
        borderRadius: 6,
        iconData: {
          size: 13,
          xOffset: (20 - 13) / 2,
          yOffset: (20 - 13) / 2,
        },
        mousePosition,
        spriteLoader,
        icon: 'maximize',
        background: 'white',
        setCursor,
      })
    }

    if (!text) {
      if (!props.tag?.renderAsTag && isHovered) {
        renderExpandIcon()
      }

      return {
        x,
        y,
      }
    }

    if (props.tag?.renderAsTag) {
      return renderTagLabel(ctx, { ...props, text, renderAsMarkdown: isRichMode })
    } else if (isRichMode) {
      const { x: xOffset, y: yOffset } = renderMarkdown(ctx, {
        x: x + padding,
        y,
        text,
        maxWidth: width - padding * 2,
        fontFamily: `${pv ? 600 : 500} 13px Manrope`,
        fillStyle: pv ? '#3366FF' : textColor,
        height,
        mousePosition,
        spriteLoader,
        cellRenderStore: props.cellRenderStore,
      })

      if (!props.tag?.renderAsTag && isHovered) {
        renderExpandIcon()
      }

      return {
        x: xOffset,
        y: yOffset,
      }
    } else {
      const { x: xOffset, y: yOffset } = renderMultiLineText(ctx, {
        x: x + padding,
        y,
        text,
        maxWidth: width - padding * 2,
        fontFamily: `${pv ? 600 : 500} 13px Manrope`,
        fillStyle: pv ? '#3366FF' : textColor,
        height,
        cellRenderStore: props.cellRenderStore,
      })

      if (!props.tag?.renderAsTag && isHovered) {
        renderExpandIcon()
      }

      return {
        x: xOffset,
        y: yOffset,
      }
    }
  },
  handleClick: async (props) => {
    const { column, getCellPosition, row, mousePosition, makeCellEditable, cellRenderStore } = props

    const isRichMode = column.columnObj?.meta?.richMode

    if (isRichMode) {
      const links: { x: number; y: number; width: number; height: number; url: string }[] = cellRenderStore?.links || []

      for (const link of links) {
        if (isBoxHovered(link, mousePosition)) {
          window.open(link.url, '_blank')
          return true
        }
      }
    }

    if (isAIPromptCol(column?.columnObj)) {
      return AILongTextCellRenderer.handleClick!(props)
    } else {
      const { x, y, width } = getCellPosition(column, row.rowMeta.rowIndex!)

      if (isBoxHovered({ x: x + width - 28, y: y + 7, width: 18, height: 18 }, mousePosition)) {
        makeCellEditable(row.rowMeta.rowIndex!, column)
        return true
      }
      return false
    }
  },
  async handleKeyDown(ctx) {
    const { e, row, column, makeCellEditable } = ctx
    if (isAIPromptCol(column?.columnObj)) {
      return AILongTextCellRenderer.handleKeyDown?.(ctx)
    }
    if (column.readonly) return
    if (/^[a-zA-Z0-9]$/.test(e.key)) {
      makeCellEditable(row.rowMeta!.rowIndex!, column)
      return true
    }

    return false
  },
  handleHover: async (props) => {
    const { row, column, value, mousePosition, getCellPosition, cellRenderStore, setCursor } = props

    const isRichMode = column.columnObj?.meta?.richMode

    if (isRichMode) {
      const links: { x: number; y: number; width: number; height: number; url: string }[] = cellRenderStore?.links || []

      let hoveringAnyLink = false

      for (const link of links) {
        if (isBoxHovered(link, mousePosition)) {
          hoveringAnyLink = true
          break
        }
      }

      if (hoveringAnyLink) {
        setCursor('pointer')
        return
      }
    }

    if (isAIPromptCol(column?.columnObj)) {
      AILongTextCellRenderer.handleHover?.(props)
    } else {
      const { tryShowTooltip, hideTooltip } = useTooltipStore()
      hideTooltip()

      const text = value?.toString() ?? ''

      if (!row || !column?.id || !mousePosition || !text) return

      const { x, y, width } = getCellPosition(column, row.rowMeta.rowIndex!)
      const box = { x: x + width - 28, y: y + 7, width: 18, height: 18 }
      tryShowTooltip({ rect: box, mousePosition, text: getI18n().global.t('title.expand') })
    }
  },
}
