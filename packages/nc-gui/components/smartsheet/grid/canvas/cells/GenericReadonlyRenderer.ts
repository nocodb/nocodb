import { renderMultiLineText, renderTagLabel } from '../utils/canvas'

export const GenericReadOnlyRenderer: CellRenderer = {
  render: (ctx, props) => {
    const { value, x, y, width, height, pv, padding, textColor = themeV4Colors.gray['600'], getColor } = props

    const text = value?.toString() ?? ''

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
}
