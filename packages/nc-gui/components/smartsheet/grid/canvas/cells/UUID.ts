import { renderMultiLineText, renderTagLabel } from '../utils/canvas'
import { showFieldEditWarning } from '../utils/cell'

export const UUIDCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const { value, x, y, width, height, pv, padding, textColor = themeV4Colors.gray['600'], getColor } = props
    const text = (Array.isArray(value) ? value.join(',') : value?.toString()) ?? ''

    if (!text) {
      return {
        x,
        y,
      }
    }

    if (props.tag?.renderAsTag) {
      return renderTagLabel(ctx, { ...props, text })
    } else {
      const { x: xOffset, y: yOffset } = renderMultiLineText(ctx, {
        x: x + padding,
        y,
        text,
        maxWidth: width - padding * 2,
        fontFamily: `${pv ? 600 : 500} 13px Inter`,
        fillStyle: pv ? getColor(themeV4Colors.brand['500']) : getColor(textColor),
        height,
      })

      return {
        x: xOffset,
        y: yOffset,
      }
    }
  },
  handleClick: async (ctx) => {
    const { isDoubleClick } = ctx

    // Show read-only warning on double-click
    if (isDoubleClick) {
      showFieldEditWarning()
      return true
    }

    return false
  },
  handleKeyDown: async (ctx) => {
    // UUID fields are read-only, show warning on edit attempt
    const { e } = ctx

    if (e.key.length === 1) {
      showFieldEditWarning()
      return true
    }

    return false
  },
}
