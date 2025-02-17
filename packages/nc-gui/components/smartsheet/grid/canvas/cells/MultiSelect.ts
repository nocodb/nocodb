import { defaultOffscreen2DContext, isBoxHovered, renderSingleLineText, renderTag } from '../utils/canvas'
import type { getSingleMultiselectColOptions } from '../utils/cell'
import type { RenderRectangleProps } from '../utils/types'

export const MultiSelectCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const { column, x: _x, y: _y, width: _width, height, pv, padding } = props
    let x = _x + padding
    let y = _y
    let width = _width - padding * 2
    const tagPadding = 9
    const tagSpacingY = 4
    const tagSpacingX = 8
    const tagHeight = 20
    const topPadding = 6
    const defaultColor = '#666'
    const ellipsisWidth = 15

    width = width - padding * 2

    const selectedOptions = MultiSelectCellRenderer.getSelectedOptions(props)

    if (!selectedOptions.length) return

    const optionsMap = (column.extra as ReturnType<typeof getSingleMultiselectColOptions>)?.optionsMap
    let count = 0
    let line = 1
    for (const option of selectedOptions) {
      const text = option?.trim() ?? ''

      const { text: truncatedText, width: optionWidth } = renderSingleLineText(ctx, {
        text,
        maxWidth: width - tagPadding * 2,
        render: false,
      })

      // Check if the tag fits in the current row
      if (x + optionWidth + tagPadding * 2 > _x + _width - padding * 2) {
        // Check if there is space for `...` on the same line

        if (y + tagHeight * 2 + tagSpacingY > _y + height || count === 0 || line >= rowHeightTruncateLines(height, true)) {
          // Not enough space for `...` on the current line, so stop rendering
          renderSingleLineText(ctx, {
            x: x + padding + tagSpacingX, // Align `...` at the end
            y,
            text: '...',
            maxWidth: ellipsisWidth,
            textAlign: 'right',
            verticalAlign: 'middle',
            fontFamily: '500 13px Manrope',
            fillStyle: defaultColor,
            height,
          })
          x = x + padding + tagSpacingX + ellipsisWidth
          y = y + tagHeight + tagSpacingY
          break
        }

        // Wrap to the next line
        x = _x + padding // Reset x to start of the row
        y += tagHeight + tagSpacingY // Move to the next line
        line += 1
      }

      renderTag(ctx, {
        x,
        y: y + topPadding,
        width: optionWidth + tagPadding * 2,
        height: tagHeight,
        radius: 12,
        fillStyle: optionsMap[text]?.color ?? defaultColor,
      })

      renderSingleLineText(ctx, {
        x: x + tagPadding,
        y: y + 1,
        text: truncatedText,
        maxWidth: width - tagPadding * 2,
        textAlign: 'left',
        verticalAlign: 'middle',
        fontFamily: `${pv ? 600 : 500} 13px Manrope`,
        fillStyle: getSelectTypeOptionTextColor(optionsMap[text]?.color ?? defaultColor),
        height,
      })

      x = x + optionWidth + tagPadding * 2 + tagSpacingX
      count++
    }
    return {
      x,
      y,
      nextLine: count < selectedOptions.length,
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
          const opa = optionsMap[a?.trim()]
          const opb = optionsMap[b?.trim()]
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

    const { x: _x, y: _y, width: _width, height } = getCellPosition(column, row.rowMeta.rowIndex!)
    const padding = 10

    let x = _x + padding
    let y = _y
    let width = _width - padding * 2
    const tagPadding = 8
    const tagSpacingY = 4
    const tagSpacingX = 8
    const tagHeight = 20
    const topPadding = 6

    width = width - padding * 2

    const selectedOptions = MultiSelectCellRenderer.getSelectedOptions({ column: column.columnObj, value })

    if (!selectedOptions.length) return
    const boxes: (RenderRectangleProps & { text: string })[] = []
    let count = 0
    let line = 1
    const ctx = defaultOffscreen2DContext
    for (const option of selectedOptions) {
      const text = option?.trim() ?? ''

      const { text: truncatedText, width: optionWidth } = renderSingleLineText(ctx, {
        text,
        maxWidth: width - tagPadding * 2,
        render: false,
      })

      // Check if the tag fits in the current row
      if (x + optionWidth + tagPadding * 2 > _x + _width - padding * 2) {
        // Check if there is space for `...` on the same line

        if (y + tagHeight * 2 + tagSpacingY > _y + height || count === 0 || line >= rowHeightTruncateLines(height, true)) {
          // Not enough space for `...` on the current line, so stop rendering
          break
        }

        // Wrap to the next line
        x = _x + padding // Reset x to start of the row
        y += tagHeight + tagSpacingY // Move to the next line
        line += 1
      }
      if (text !== truncatedText) {
        boxes.push({
          x,
          y: y + topPadding,
          width: optionWidth + tagPadding * 2,
          height: tagHeight,
          text,
        })
      }

      x = x + optionWidth + tagPadding * 2 + tagSpacingX
      count++
    }

    if (!boxes.length) return

    const hoveredBox = boxes.find((box) => isBoxHovered(box, mousePosition))
    if (!hoveredBox) return
    tryShowTooltip({
      rect: hoveredBox,
      mousePosition,
      text: hoveredBox.text,
    })
  },

  async handleClick({ row, column, makeCellEditable }) {
    if (column.columnObj?.readonly) return false
    makeCellEditable(row, column)
    return true
  },
  async handleKeyDown({ e, row, column, makeCellEditable }) {
    if (column.readonly) return false
    if (e.key.length === 1 || e.key === 'Enter') {
      makeCellEditable(row, column)
      return true
    }

    return false
  },
}
