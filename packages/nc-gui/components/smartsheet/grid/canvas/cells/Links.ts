import { isBoxHovered, renderSingleLineText, renderTagLabel } from '../utils/canvas'

export const LinksCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const { column, value, x, y, width, height, padding, t, spriteLoader, mousePosition, readonly, setCursor } = props

    const parsedValue = +value || 0

    let text = ''
    if (!parsedValue) {
      text = t('msg.noRecordsLinked')
    } else if (parsedValue === 1) {
      text = `1 ${column?.meta?.singular || t('general.link')}`
    } else {
      text = `${parsedValue} ${column?.meta?.plural || t('general.links')}`
    }

    if (props.tag?.renderAsTag) {
      return renderTagLabel(ctx, { ...props, text })
    } else {
      const { y: textYOffset, width: textWidth } = renderSingleLineText(ctx, {
        x: x + padding,
        y,
        text,
        maxWidth: width - padding * 2 - 20,
        fontFamily: '500 13px Manrope',
        fillStyle: 'rgb(67, 81, 232)',
        height,
      })

      const isHoverOverText = isBoxHovered({ x: x + padding, y, width: textWidth, height: textYOffset - y }, mousePosition)

      const { x: xOffset, y: yOffset } = renderSingleLineText(ctx, {
        x: x + padding,
        y,
        text,
        maxWidth: width - padding * 2 - 20,
        fontFamily: '500 13px Manrope',
        fillStyle: 'rgb(67, 81, 232)',
        height,
        underline: isHoverOverText,
      })

      if (isBoxHovered({ x, y, width, height }, mousePosition) && !readonly) {
        spriteLoader.renderIcon(ctx, {
          icon: 'ncPlus',
          x: x + width - 16 - padding,
          y: y + 7,
          size: 16,
          color: '#374151',
        })

        if (isHoverOverText || isBoxHovered({ x: x + width - 16 - padding, y: y + 7, width: 16, height: 16 }, mousePosition)) {
          setCursor('pointer')
        }
      }

      return {
        x: xOffset,
        y: yOffset,
      }
    }
  },
  async handleClick({ row, column, getCellPosition, mousePosition, makeCellEditable }) {
    const rowIndex = row.rowMeta.rowIndex!
    const { x, y, width, height } = getCellPosition(column, rowIndex)
    const padding = 10
    const buttonSize = 16
    if (
      isBoxHovered({ x: x + width - 16 - padding, y: y + 7, height: buttonSize, width: buttonSize }, mousePosition) ||
      isBoxHovered({ x: x + padding, y, height, width: width - padding * 2 }, mousePosition)
    ) {
      makeCellEditable(rowIndex, column)
      return true
    }
    return false
  },
}
