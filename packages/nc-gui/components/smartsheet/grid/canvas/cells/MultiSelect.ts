import { renderSingleLineText, renderTag, roundedRect, truncateText } from '../utils/canvas'
import type { getSingleMultiselectColOptions } from '../utils/cell'

const tagPadding = 8
const tagSpacing = 4
const tagHeight = 20
const topPadding = 6
const defaultColor = '#666'
const padding = 10

export const MultiSelectCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const { column, x: _x, y: _y, width: _width, height, pv } = props
    let x = _x
    let y = _y
    let width = _width - padding * 2

    width = width - padding * 2

    const selectedOptions = MultiSelectCellRenderer.getSelectedOptions(props)

    if (!selectedOptions.length) return

    const optionsMap = (column.extra as ReturnType<typeof getSingleMultiselectColOptions>)?.optionsMap

    for (const option of selectedOptions) {
      const text = option?.trim() ?? ''

      const { text: truncatedText, width: optionWidth } = renderSingleLineText(ctx, {
        text,
        maxWidth: width - tagPadding * 2,
        render: false,
      })

      // Todo wrap options below if rowHeight is more than 1
      if (x + optionWidth + tagPadding * 2 > _x + _width) {
        break
      }

      renderTag(ctx, {
        x: x + padding,
        y: y + topPadding,
        width: optionWidth + tagPadding * 2,
        height: tagHeight,
        radius: 12,
        fillStyle: optionsMap[text]?.color ?? defaultColor,
      })

      renderSingleLineText(ctx, {
        x: x + padding + tagPadding,
        y: y + padding,
        text: truncatedText,
        maxWidth: optionWidth,
        textAlign: 'left',
        verticalAlign: 'middle',
        fontFamily: `${pv ? 600 : 500} 13px Manrope`,
        fillStyle: getSelectTypeOptionTextColor(optionsMap[text]?.color ?? defaultColor),
        height,
      })

      x = x + optionWidth + tagPadding * 2 + tagSpacing
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
