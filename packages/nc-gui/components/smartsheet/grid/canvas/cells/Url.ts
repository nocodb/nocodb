import { getI18n } from '../../../../../plugins/a.i18n'
import { defaultOffscreen2DContext, isBoxHovered, renderMultiLineText, renderTagLabel, truncateText } from '../utils/canvas'

export const UrlCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const { value, x, y, column, width, height, selected, pv, padding, textColor = '#4a5268' } = props

    const text = value?.toString() ?? ''

    if (!text) {
      return {
        x,
        y,
      }
    }

    const isValid = text && isValidURL(text)

    if (props.tag?.renderAsTag) {
      return renderTagLabel(ctx, { ...props, text })
    } else {
      const iconSize = 16

      const validate = parseProp(column?.meta).validate

      const maxWidth = width - padding * 2 - (validate && !isValid ? iconSize + 4 : 0)

      const { x: xOffset, y: yOffset } = renderMultiLineText(ctx, {
        x: x + padding,
        y,
        text,
        maxWidth: maxWidth,
        fontFamily: `${pv ? 600 : 500} 13px Manrope`,
        fillStyle: (isValid && selected) || pv ? '#3366FF' : textColor,
        underline: isValid,
        height,
      })

      if (validate && !isValid) {
        const iconX = x + width - iconSize - padding

        ctx.fillStyle = '#f87171'
        ctx.beginPath()
        ctx.arc(iconX + iconSize / 2, yOffset!, iconSize / 2, 0, 2 * Math.PI)
        ctx.fill()

        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 12px sans-serif'
        ctx.fillText('i', iconX + 6, yOffset! + 2)
      }

      return {
        x: xOffset ? xOffset + (validate && !isValid ? iconSize + 4 : 0) : xOffset,
        y: yOffset,
      }
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
