import { renderSingleLineText, renderTag } from '../utils/canvas'
import type { getSingleMultiselectColOptions } from '../utils/cell'

const tagPadding = 8
const tagSpacing = 4
const tagHeight = 20
const topPadding = 6
const defaultColor = '#666'

export const MultiSelectCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const { column, x: _x, y: _y, width: _width, height, pv, padding } = props
    let x = _x + padding
    let y = _y
    let width = _width - padding * 2

    width = width - padding * 2

    const selectedOptions = MultiSelectCellRenderer.getSelectedOptions(props)

    if (!selectedOptions.length) return

    const optionsMap = (column.extra as ReturnType<typeof getSingleMultiselectColOptions>)?.optionsMap
    let count = 0
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
        const ellipsisWidth = ctx.measureText('...').width
        if (y + tagHeight * 2 + tagSpacing > _y + height || count === 0) {
          // Not enough space for `...` on the current line, so stop rendering
          renderSingleLineText(ctx, {
            x: x + padding + tagSpacing, // Align `...` at the end
            y: y,
            text: '...',
            maxWidth: ellipsisWidth,
            textAlign: 'right',
            verticalAlign: 'middle',
            fontFamily: `${pv ? 600 : 500} 13px Manrope`,
            fillStyle: defaultColor,
            height,
          })
          break
        }

        // Wrap to the next line
        x = _x + padding // Reset x to start of the row
        y += tagHeight + tagSpacing // Move to the next line
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
        y: y,
        text: truncatedText,
        maxWidth: width - tagPadding * 2,
        textAlign: 'left',
        verticalAlign: 'middle',
        fontFamily: `${pv ? 600 : 500} 13px Manrope`,
        fillStyle: getSelectTypeOptionTextColor(optionsMap[text]?.color ?? defaultColor),
        height,
      })

      x = x + optionWidth + tagPadding * 2 + tagSpacing
      count++
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
}
