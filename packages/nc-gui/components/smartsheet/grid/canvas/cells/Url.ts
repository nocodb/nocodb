import { getI18n } from '../../../../../plugins/a.i18n';
import { isBoxHovered, truncateText } from '../utils/canvas';

export const UrlCellRenderer: CellRenderer = {
  render: (ctx, { value, x, y, width, height, selected, pv, column, padding }) => {
    ctx.font = `${pv ? 600 : 500} 13px Manrope`
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'

    const urlText = value?.toString().trim() ?? ''
    const isValid = urlText && isValidURL(urlText)
    const maxWidth = width - padding * 2

    const truncatedText = truncateText(ctx, urlText, maxWidth)
    const textY = y + height / 2
    const textMetrics = ctx.measureText(truncatedText)

    ctx.fillStyle = (isValid && selected) || pv ? '#4351e8' : '#4a5268'
    ctx.fillText(truncatedText, x + padding, textY)

    if (isValid) {
      ctx.beginPath()
      ctx.moveTo(x + padding, textY + 6)
      ctx.lineTo(x + padding + textMetrics.width, textY + 6)
      ctx.strokeStyle = selected ? '#4351e8' : '#4a5268'
      ctx.lineWidth = 1
      ctx.stroke()
    }

    if (parseProp(column?.meta).validate && !isValid && urlText.length) {
      const iconSize = 16
      const iconX = x + width - iconSize - padding

      ctx.fillStyle = '#f87171'
      ctx.beginPath()
      ctx.arc(iconX + iconSize / 2, textY, iconSize / 2, 0, 2 * Math.PI)
      ctx.fill()

      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 12px sans-serif'
      ctx.fillText('i', iconX + 6, textY + 2)
    }
  },
  async handleHover({ column, row, getCellPosition, value, mousePosition }) {
    const { x, y, width, height } = getCellPosition(column, row.rowMeta.rowIndex!)
    const { showTooltip, hideTooltip } = useTooltipStore()
    hideTooltip()
    const urlText = value?.toString().trim() ?? ''
    const isValid = urlText && isValidURL(urlText)
    if (isValid) return
    const iconSize = 16
    const padding = 10
    const iconX = x + width - iconSize - padding
    const textY = y + height / 2
    const box = { x: iconX, y: textY, width: iconSize, height: iconSize }
    if (isBoxHovered(box, mousePosition))
      showTooltip({
        position: {
          x: box.x + box.width / 2,
          y: box.y + 10,
        },
        text: getI18n().global.t('msg.error.invalidURL'),
      })
  },
  async handleKeyDown(ctx) {
    const { e, row, column, updateOrSaveRow, makeCellEditable } = ctx
    const columnObj = column.columnObj

    if (isTypableInputColumn(columnObj) && columnObj.title && e.key.length === 1) {
      row.row[columnObj.title] = row.row[columnObj.title] ? row.row[columnObj.title] + e.key : e.key
      makeCellEditable(row, column)
      updateOrSaveRow(row, columnObj.title)
      return true
    }

    return false
  },
}
