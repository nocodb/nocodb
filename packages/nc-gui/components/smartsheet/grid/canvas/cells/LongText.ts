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

    const {
      value,
      x,
      y,
      width,
      height,
      pv,
      padding,
      textColor = '#4a5268',
      mousePosition,
      spriteLoader,
      setCursor,
      selected,
      baseUsers,
      user,
    } = props

    const text = value?.toString() ?? ''

    const renderExpandIcon = () => {
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
    }

    if (!text) {
      if (!props.tag?.renderAsTag && selected) {
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
      // Begin clipping
      ctx.save()
      ctx.beginPath()
      ctx.rect(x, y, width - padding, height) // Define the clipping rectangle
      ctx.clip()

      const { x: xOffset, y: yOffset } = renderMarkdown(ctx, {
        x: x + padding,
        y,
        text,
        maxWidth: width - padding * 2,
        fontFamily: `${pv ? 600 : 500} 13px Inter`,
        fillStyle: pv ? '#3366FF' : textColor,
        height,
        mousePosition,
        spriteLoader,
        cellRenderStore: props.cellRenderStore,
        selected,
        baseUsers,
        user,
      })

      // Restore context after clipping
      ctx.restore()

      if (!props.tag?.renderAsTag && selected) {
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
        fontFamily: `${pv ? 600 : 500} 13px Inter`,
        fillStyle: pv ? '#3366FF' : textColor,
        height,
        cellRenderStore: props.cellRenderStore,
      })

      if (!props.tag?.renderAsTag && selected) {
        renderExpandIcon()
      }

      return {
        x: xOffset,
        y: yOffset,
      }
    }
  },
  handleClick: async (props) => {
    const { column, getCellPosition, row, mousePosition, makeCellEditable, cellRenderStore, isDoubleClick, selected } = props

    if (!selected && !isDoubleClick) return false

    const isRichMode = column.columnObj?.meta?.richMode

    if (isRichMode) {
      const links: { x: number; y: number; width: number; height: number; url: string }[] = cellRenderStore?.links || []

      for (const link of links) {
        if (isBoxHovered(link, mousePosition)) {
          confirmPageLeavingRedirect(link.url, '_blank')
          return true
        }
      }
    }

    if (isAIPromptCol(column?.columnObj)) {
      return AILongTextCellRenderer.handleClick!(props)
    } else {
      const { x, y, width, height } = getCellPosition(column, row.rowMeta.rowIndex!)

      if (isBoxHovered({ x: x + width - 28, y: y + 7, width: 18, height: 18 }, mousePosition)) {
        makeCellEditable(row, column)
        return true
      }

      if (isDoubleClick && isBoxHovered({ x, y, width, height }, mousePosition)) {
        makeCellEditable(row, column)
      }
      return false
    }
  },
  async handleKeyDown(ctx) {
    const { e, row, column, makeCellEditable } = ctx

    const columnObj = column?.columnObj

    if (isAIPromptCol(columnObj)) {
      return AILongTextCellRenderer.handleKeyDown?.(ctx)
    }

    if (isExpandCellKey(e)) {
      makeCellEditable(row, column)
      return true
    }

    if (column.readonly || columnObj?.readonly) return

    if (e.key.length === 1 && columnObj.title) {
      if (row.row[columnObj.title] === '<br />' || row.row[columnObj.title] === '<br>') {
        row.row[columnObj.title] = e.key
      } else if (parseProp(columnObj.meta).richMode) {
        row.row[columnObj.title] = row.row[columnObj.title] ? row.row[columnObj.title] + e.key : e.key
      }

      makeCellEditable(row, column)
      return true
    }

    return false
  },
  handleHover: async (props) => {
    const { row, column, value, mousePosition, getCellPosition, cellRenderStore, setCursor, selected } = props

    if (!selected && !isAIPromptCol(column?.columnObj)) {
      return
    }

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
      tryShowTooltip({ rect: box, mousePosition, text: getI18n().global.t('tooltip.expandShiftSpace') })
    }
  },
}
