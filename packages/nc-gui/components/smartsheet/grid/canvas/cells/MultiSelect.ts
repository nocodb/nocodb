import { defaultOffscreen2DContext, isBoxHovered, renderSingleLineText, renderTag } from '../utils/canvas'
import type { getSingleMultiselectColOptions } from '../utils/cell'
import type { RenderRectangleProps } from '../utils/types'

const tagPadding = 8
const tagSpacingY = 4
const tagSpacingX = 8
const tagHeight = 22
const topPadding = 4

interface TagLayout extends RenderRectangleProps {
  text: string
  truncatedText: string
  lineY: number
}

// Single source of tag positions for both drawing and hover hit-testing
function layoutTags(
  ctx: Parameters<typeof renderSingleLineText>[0],
  options: string[],
  { x: _x, y: _y, width: _width, height, padding }: { x: number; y: number; width: number; height: number; padding: number },
) {
  const maxWidth = _width - padding * 4 - tagPadding * 2
  const tags: TagLayout[] = []
  let x = _x + padding
  let y = _y
  let line = 1

  for (const option of options) {
    const text = option?.trim() ?? ''
    const { text: truncatedText, width: optionWidth } = renderSingleLineText(ctx, { text, maxWidth, render: false })

    if (x + optionWidth + tagPadding * 2 > _x + _width - padding * 2) {
      if (y + tagHeight * 2 + tagSpacingY > _y + height || !tags.length || line >= rowHeightTruncateLines(height, true)) {
        return { tags, x, y, overflow: true, maxWidth }
      }

      x = _x + padding
      y += tagHeight + tagSpacingY
      line += 1
    }

    tags.push({ x, y: y + topPadding, width: optionWidth + tagPadding * 2, height: tagHeight, text, truncatedText, lineY: y })
    x += optionWidth + tagPadding * 2 + tagSpacingX
  }

  return { tags, x, y, overflow: false, maxWidth }
}

export const MultiSelectCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const { column, x: _x, y: _y, width: _width, height, pv, padding, isDark, getColor } = props
    const defaultColor = '#666'
    const ellipsisWidth = 15

    const selectedOptions = MultiSelectCellRenderer.getSelectedOptions(props)

    if (!selectedOptions.length) return

    const extra = column.extra as ReturnType<typeof getSingleMultiselectColOptions>
    const optionsMap = extra?.optionsMap
    const isColorCodeEnabled = extra?.isColorCodeEnabled !== false

    const layout = layoutTags(ctx, selectedOptions, { x: _x, y: _y, width: _width, height, padding })
    let { x, y } = layout

    for (const tag of layout.tags) {
      const opColor = isColorCodeEnabled ? optionsMap?.[tag.text]?.color ?? '#e7e7e9' : undefined
      const chip = getSelectChipColors(opColor ?? '#e7e7e9', isDark)
      const opBgColor = isColorCodeEnabled ? chip.bg : getColor('var(--nc-bg-gray-medium)', 'var(--nc-bg-gray-light)')
      const opTextColor = isColorCodeEnabled ? chip.ink : getColor('var(--nc-content-gray)')

      renderTag(ctx, {
        x: tag.x,
        y: tag.y,
        width: tag.width,
        height: tag.height,
        radius: 12,
        fillStyle: opBgColor,
      })

      renderSingleLineText(ctx, {
        x: tag.x + tagPadding,
        y: tag.lineY,
        text: tag.truncatedText,
        maxWidth: layout.maxWidth,
        textAlign: 'left',
        verticalAlign: 'middle',
        fontFamily: `${pv ? 600 : 500} 13px Inter`,
        fillStyle: opTextColor,
        height,
      })
    }

    if (layout.overflow) {
      renderSingleLineText(ctx, {
        x: x + padding + tagSpacingX,
        y,
        text: '...',
        maxWidth: ellipsisWidth,
        textAlign: 'right',
        verticalAlign: 'middle',
        fontFamily: '500 13px Inter',
        fillStyle: defaultColor,
        height,
      })
      x = x + padding + tagSpacingX + ellipsisWidth
      y = y + tagHeight + tagSpacingY
    }

    return {
      x,
      y,
      nextLine: layout.tags.length < selectedOptions.length,
    }
  },
  getSelectedOptions: (props: Partial<CellRendererOptions>): string[] => {
    const { column, value, isMysql } = props
    if (!column || !value) return []

    if (ncIsArray(value)) {
      return value
    } else if (isMysql?.(column?.source_id)) {
      const optionsMap = (column.extra as ReturnType<typeof getSingleMultiselectColOptions>)?.optionsMap

      return value
        .toString()
        .split(',')
        .sort((a, b) => {
          const opa = optionsMap?.[a?.trim()]
          const opb = optionsMap?.[b?.trim()]
          if (opa && opb) {
            return opa.order! - opb.order!
          }
          return 0
        })
    } else {
      return value.toString().split(',')
    }
  },

  async handleHover({ row, column, mousePosition, getCellPosition, value }) {
    const { tryShowTooltip, hideTooltip } = useTooltipStore()
    hideTooltip()
    if (!row || !column?.id || !mousePosition) return

    const cell = getCellPosition(column, row.rowMeta.rowIndex!)
    const selectedOptions = MultiSelectCellRenderer.getSelectedOptions({ column: column.columnObj, value })

    if (!selectedOptions.length) return

    const { tags } = layoutTags(defaultOffscreen2DContext, selectedOptions, { ...cell, padding: 10 })
    const hoveredTag = tags.find((tag) => tag.text !== tag.truncatedText && isBoxHovered(tag, mousePosition))
    if (!hoveredTag) return

    const { x, y, width, height, text } = hoveredTag
    tryShowTooltip({
      rect: { x, y, width, height, showAtMousePosition: true },
      mousePosition,
      text,
    })
  },

  async handleClick({ row, column, makeCellEditable, selected }) {
    if (column.columnObj?.readonly || !column?.isCellEditable || !selected || column.isSyncedColumn) return false
    makeCellEditable(row, column)
    return true
  },

  async handleKeyDown({ e, row, column, makeCellEditable }) {
    if (column.readonly || column.columnObj?.readonly || !column?.isCellEditable || column.isSyncedColumn) return false
    if (e.key.length === 1 || e.key === 'Enter') {
      makeCellEditable(row, column)
      return true
    }

    return false
  },
}
