import { renderSingleLineText, roundedRect } from '../utils/canvas'

export const PercentCellRenderer: CellRenderer = {
  render: (ctx, { value, x, y, width, height, pv, column, padding }) => {
    ctx.font = `${pv ? 600 : 500} 13px Manrope`
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
      const barWidth = (width - padding * 2) * (percent / 100)

      roundedRect(ctx, x + padding, barY, width - padding * 2, barHeight, barHeight / 2, {
        backgroundColor: '#E5E5E5',
      })
      if (percent === 0) return

      roundedRect(ctx, x + padding, barY, barWidth, barHeight, barHeight / 2, {
        backgroundColor: '#3366FF',
      })
      return
    }

    ctx.fillStyle = pv ? '#3366FF' : '#4a5268'

    renderSingleLineText(ctx, {
      x: x + width - padding,
      y,
      text: value ? `${value}%` : '',
      textAlign: 'right',
      maxWidth: width - padding * 2,
      fontFamily: `${pv ? 600 : 500} 13px Manrope`,
      fillStyle: pv ? '#3366FF' : '#4a5268',
      height,
    })
  },
  async handleKeyDown(ctx) {
    const { e, row, column, makeCellEditable } = ctx
    if (column.readonly) return
    const columnObj = column.columnObj

    if (/^[0-9]$/.test(e.key) && columnObj.title) {
      row.row[columnObj.title] = ''
      makeCellEditable(row, column)
      return true
    }

    return false
  },
}
