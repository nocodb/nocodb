import { getI18n } from '../../../../../plugins/a.i18n'
import { defaultOffscreen2DContext, isBoxHovered, truncateText } from '../utils/canvas'

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

    ctx.fillStyle = (isValid && selected) || pv ? '#3366FF' : '#4a5268'
    ctx.fillText(truncatedText, x + padding, textY)

    if (isValid) {
      ctx.beginPath()
      ctx.moveTo(x + padding, textY + 6)
      ctx.lineTo(x + padding + textMetrics.width, textY + 6)
      ctx.strokeStyle = selected ? '#3366FF' : '#4a5268'
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
    const { tryShowTooltip, hideTooltip } = useTooltipStore()
    hideTooltip()
    const urlText = value?.toString().trim() ?? ''
    const isValid = urlText && isValidURL(urlText)
    if (isValid) return
    const iconSize = 16
    const padding = 10
    const iconX = x + width - iconSize - padding
    const textY = y + height / 2
    const box = { x: iconX, y: textY, width: iconSize, height: iconSize }

    tryShowTooltip({
      rect: box,
      text: getI18n().global.t('msg.error.invalidURL'),
      mousePosition,
    })
  },
  async handleKeyDown(ctx) {
    const { e, row, column, makeCellEditable } = ctx
    if (column.readonly) return
    const columnObj = column.columnObj
    if (e.key.length === 1 && columnObj.title) {
      row.row[columnObj.title] = ''
      makeCellEditable(row, column)
      return true
    }

    return false
  },
  async handleClick({ value, row, column, getCellPosition, mousePosition }) {
    const { x, y, width, height } = getCellPosition(column, row.rowMeta.rowIndex!)
    const padding = 10
    const urlText = value?.toString().trim() ?? ''
    const isValid = urlText && isValidURL(urlText)
    if (!isValid) return false
    const pv = column.pv
    const ctx = defaultOffscreen2DContext
    ctx.font = `${pv ? 600 : 500} 13px Manrope`
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'
    const maxWidth = width - padding * 2
    const truncatedText = truncateText(ctx, urlText, maxWidth)
    const textY = y + height / 2
    const textMetrics = ctx.measureText(truncatedText)
    const box = {
      x: x + padding - 5,
      y: textY - 5,
      width: textMetrics.width + 5,
      height: 18 + 5,
    }
    if (isBoxHovered(box, mousePosition)) {
      window.open(/^https?:\/\//.test(urlText) ? urlText : `https://${urlText}`, '_blank')
      return true
    }
    return false
  },
}
