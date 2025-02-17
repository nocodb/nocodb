import { renderSingleLineText } from '../utils/canvas'

export const PercentCellRenderer: CellRenderer = {
  render: (ctx, { value, x, y, width, height, selected, pv, column, padding }) => {
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
      const barY = y + 16
      const barWidth = (width - padding * 2) * (percent / 100)

      ctx.fillStyle = '#E5E5E5'
      ctx.fillRect(x + padding, barY, width - padding * 2, barHeight)

      ctx.fillStyle = '#3366FF'
      ctx.fillRect(x + padding, barY, barWidth, barHeight)
      return
    }

    ctx.fillStyle = selected || pv ? '#4351e8' : '#4a5268'

    renderSingleLineText(ctx, {
      x: x + width - padding,
      y,
      text: value ? `${value}%` : '',
      textAlign: 'right',
      maxWidth: width - padding * 2,
      fontFamily: `${pv ? 600 : 500} 13px Manrope`,
      fillStyle: pv ? '#4351e8' : '#4a5268',
      height,
    })
  },
  async handleKeyDown(ctx) {
    const { e, row, column, updateOrSaveRow, makeCellEditable } = ctx
    const columnObj = column.columnObj

    if (/^[0-9]$/.test(e.key) && columnObj.title) {
      row.row[columnObj.title] = e.key
      makeCellEditable(row, column)
      updateOrSaveRow(row, columnObj.title)
      return true
    }

    return false
  },
}
