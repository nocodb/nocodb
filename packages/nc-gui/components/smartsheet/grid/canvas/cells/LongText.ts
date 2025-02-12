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

    const { value, x, y, width, height, pv, padding, textColor = '#4a5268', mousePosition, spriteLoader } = props

    const text = value?.toString() ?? ''

    const isHovered = isBoxHovered({ x, y, width, height }, mousePosition)

    if (!text) {
      return {
        x,
        y,
      }
    }

    if (props.tag?.renderAsTag) {
      return renderTagLabel(ctx, { ...props, text })
    } else if (isRichMode) {
      const {
        x: xOffset,
        y: yOffset,
        links,
      } = renderMarkdown(ctx, {
        x: x + padding,
        y,
        text,
        maxWidth: width - padding * 2,
        fontFamily: `${pv ? 600 : 500} 13px Manrope`,
        fillStyle: pv ? '#3366FF' : textColor,
        height,
        mousePosition,
      })

      if (isHovered) {
        renderIconButton(ctx, {
          buttonX: x + width - 28,
          buttonY: y + 7,
          buttonSize: 18,
          borderRadius: 3,
          iconData: {
            size: 13,
            xOffset: (18 - 13) / 2,
            yOffset: (18 - 13) / 2,
          },
          mousePosition,
          spriteLoader,
          icon: 'maximize',
        })
      }

      return {
        x: xOffset,
        y: yOffset,
        links,
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
      })

      if (isHovered) {
        renderIconButton(ctx, {
          buttonX: x + width - 28,
          buttonY: y + 7,
          buttonSize: 18,
          borderRadius: 3,
          iconData: {
            size: 13,
            xOffset: (18 - 13) / 2,
            yOffset: (18 - 13) / 2,
          },
          mousePosition,
          spriteLoader,
          icon: 'maximize',
        })
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
      const links: { x: number; y: number; width: number; height: number; url: string }[] = cellRenderStore.links || []

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
    const { row, column, mousePosition, getCellPosition } = props
    if (isAIPromptCol(column?.columnObj)) {
      AILongTextCellRenderer.handleHover?.(props)
    } else {
      const { tryShowTooltip, hideTooltip } = useTooltipStore()
      hideTooltip()
      if (!row || !column?.id || !mousePosition) return

      const { x, y, width } = getCellPosition(column, row.rowMeta.rowIndex!)
      const box = { x: x + width - 28, y: y + 7, width: 18, height: 18 }
      tryShowTooltip({ rect: box, mousePosition, text: getI18n().global.t('title.expand') })
    }
  },
}
