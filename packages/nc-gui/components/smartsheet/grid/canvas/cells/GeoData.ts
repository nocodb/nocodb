import { isBoxHovered, renderMultiLineText, roundedRect } from '../utils/canvas'
import { pxToRowHeight } from '../../../../../utils/cell'

export const GeoDataCellRenderer: CellRenderer = {
  render: (ctx, { value, x, y, width, height, spriteLoader, pv, readonly, padding, mousePosition, selected, setCursor }) => {
    ctx.font = `${pv ? 600 : 500} 13px Manrope`
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'

    const [latitude, longitude] = (value || '').split(';')
    const isLocationSet = !!(latitude && longitude)
    const displayText = isLocationSet ? `${latitude}; ${longitude}` : 'Set location'
    const rowHeight = pxToRowHeight[height]

    const verticalPadding = rowHeight === 1 ? 4 : 8

    if (!isLocationSet && !readonly && selected) {
      const buttonWidth = 100
      const buttonHeight = 24
      const buttonX = x + (width - buttonWidth) / 2
      const buttonY = y + verticalPadding

      const isButtonHovered = isBoxHovered({ x: buttonX, y: buttonY, width: buttonWidth, height: buttonHeight }, mousePosition)

      if (isButtonHovered) {
        setCursor('pointer')
      }

      roundedRect(ctx, buttonX, buttonY, buttonWidth, buttonHeight, 6, {
        backgroundColor: isButtonHovered ? '#f4f4f5' : 'white',
        borderColor: '#E7E7E9',
        borderWidth: 2,
      })

      spriteLoader.renderIcon(ctx, {
        icon: 'ncMapPin',
        x: buttonX + 8,
        y: buttonY + (buttonHeight - 16) / 2,
        size: 14,
        color: '#6a7184',
      })

      ctx.fillStyle = '#374151'
      ctx.font = '10px Manrope'
      ctx.textBaseline = 'middle'
      ctx.fillText('Set location', buttonX + 28, buttonY + (buttonHeight + 2) / 2)
    } else if (isLocationSet) {
      const maxWidth = width - padding * 2

      renderMultiLineText(ctx, {
        x: x + padding,
        height,
        y,
        text: displayText,
        maxWidth,
        lineHeight: 16,
        fillStyle: pv ? '#3366FF' : '#4a5268',
      })
    }
  },
  async handleClick({ row, column, mousePosition, getCellPosition, value, selected, makeCellEditable }) {
    const { hideTooltip } = useTooltipStore()
    hideTooltip()
    const enableEdit = () => makeCellEditable(row.rowMeta.rowIndex!, column)
    const { x, y, width } = getCellPosition(column, row.rowMeta.rowIndex!)

    const [latitude, longitude] = (value || '').split(';')
    const isLocationSet = !!(latitude && longitude)

    if (selected && !isLocationSet) {
      const buttonWidth = 84
      const buttonHeight = 24
      const buttonX = x + (width - buttonWidth) / 2
      const buttonY = y + 3
      const buttonBox = { x: buttonX, y: buttonY, width: buttonWidth, height: buttonHeight }
      if (isBoxHovered(buttonBox, mousePosition)) {
        enableEdit()
        return true
      }
    }
    return false
  },
}
