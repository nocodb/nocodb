import { ncIsNaN } from 'nocodb-sdk'
import { renderSingleLineText, roundedRect } from '../utils/canvas'

export const PercentCellRenderer: CellRenderer = {
  render: (ctx, { value, x, y, width, height, pv, column, padding, textColor = themeV4Colors.gray['600'], getColor }) => {
    ctx.font = `${pv ? 600 : 500} 13px Inter`
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'

    const meta = {
      is_progress: false,
      ...parseProp(column?.meta),
    }

    if (meta.is_progress && value !== null && value !== undefined) {
      const percent = Math.min(100, Math.max(0, value))
      const barHeight = 4
      const barY = y + 14

      const { width: labelWidth } = renderSingleLineText(ctx, {
        x: x + width - padding,
        y,
        text: !ncIsNaN(value) ? formatPercentage(value) : '',
        textAlign: 'right',
        maxWidth: width - padding * 2,
        fontFamily: `${pv ? 600 : 500} 13px Inter`,
        fillStyle: pv ? getColor(themeV4Colors.brand['500']) : getColor(textColor),
        height,
        render: false,
      })

      const barWidth = (width - padding * 2 - labelWidth - 4) * (percent / 100)

      roundedRect(ctx, x + padding, barY, width - padding * 2 - labelWidth - 4, barHeight, barHeight / 2, {
        backgroundColor: '#E5E5E5',
      })

      if (percent !== 0) {
        roundedRect(ctx, x + padding, barY, barWidth, barHeight, barHeight / 2, {
          backgroundColor: getColor(themeV4Colors.brand['500']),
        })
      }

      renderSingleLineText(ctx, {
        x: x + width - padding,
        y,
        text: !ncIsNaN(value) ? formatPercentage(value) : '',
        textAlign: 'right',
        maxWidth: labelWidth,
        fontFamily: `${pv ? 600 : 500} 12px Inter`,
        fillStyle: pv ? getColor(themeV4Colors.brand['500']) : getColor(textColor),
        height,
      })

      return
    }

    ctx.fillStyle = pv ? getColor(themeV4Colors.brand['500']) : getColor(textColor)
    renderSingleLineText(ctx, {
      x: x + width - padding,
      y,
      text: value !== null && typeof value !== 'undefined' && value !== '' ? `${value}%` : '',
      textAlign: 'right',
      maxWidth: width - padding * 2,
      fontFamily: `${pv ? 600 : 500} 13px Inter`,
      fillStyle: pv ? getColor(themeV4Colors.brand['500']) : getColor(textColor),
      height,
    })
  },
  async handleKeyDown(ctx) {
    const { e, row, column, makeCellEditable } = ctx
    if (column.readonly || column.columnObj?.readonly) return
    const columnObj = column.columnObj

    if (/^[0-9]$/.test(e.key) && columnObj.title) {
      row.row[columnObj.title] = ''
      makeCellEditable(row, column)
      return true
    }

    return false
  },
}
