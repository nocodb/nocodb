import { isBoxHovered, renderSingleLineText, renderTagLabel } from '../utils/canvas'

export const LinksCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const { column, value, x, y, width, height, padding, t, spriteLoader, mousePosition } = props

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
      const { x: xOffset, y: yOffset } = renderSingleLineText(ctx, {
        x: x + padding,
        y,
        text,
        maxWidth: width - padding * 2,
        fontFamily: '500 13px Manrope',
        fillStyle: 'rgb(67, 81, 232)',
        height,
      })

      if (mousePosition.x >= x && mousePosition.x <= x + width && mousePosition.y >= y && mousePosition.y <= y + height) {
        spriteLoader.renderIcon(ctx, {
          icon: 'ncPlus',
          x: x + width - 16 - padding,
          y: y + 7,
          size: 16,
          color: '#374151',
        })
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
