import { ColumnHelper, UITypes, ncIsNaN } from 'nocodb-sdk'
import { renderSingleLineText, roundedRect } from '../utils/canvas'

export const PercentCellRenderer: CellRenderer = {
  render: (ctx, { value, x, y, width, height, pv, column, padding, textColor = themeV4Colors.gray['600'], getColor }) => {
    ctx.font = `${pv ? 600 : 500} 13px Inter`
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'

    const meta = {
      ...ColumnHelper.getColumnDefaultMeta(UITypes.Percent),
      ...parseProp(column?.meta),
    }

    if (meta.is_progress && value !== null && value !== undefined) {
      const percent = Math.min(100, Math.max(0, value))

      if (meta.shape === 'circle') {
        const radius = Math.max(4, Math.min(8, Math.floor((height - 12) / 2)))
        const cx = x + padding + radius
        // Top-anchored to match the bar (barY 14 + barHeight 4 / 2 = 16) and the
        // label, so tall rows keep the ring at the top instead of centering it.
        const cy = y + 16

        // background track ring
        ctx.beginPath()
        ctx.arc(cx, cy, radius, 0, 2 * Math.PI)
        ctx.strokeStyle = getColor('#E5E5E5', 'var(--nc-bg-brand-inverted)')
        ctx.lineWidth = 1.5
        ctx.stroke()

        // progress arc — starts at 12 o'clock, sweeps clockwise
        if (percent > 0) {
          const startAngle = -Math.PI / 2
          ctx.beginPath()
          ctx.lineWidth = 2
          ctx.lineCap = 'round'
          ctx.strokeStyle = getColor(themeV4Colors.brand['500'])
          ctx.arc(cx, cy, radius, startAngle, startAngle + (2 * Math.PI * percent) / 100)
          ctx.stroke()
          ctx.lineCap = 'butt'
        }

        // percentage label, positioned just right of the ring (reads as one unit)
        const labelX = cx + radius + 8
        renderSingleLineText(ctx, {
          x: labelX,
          y,
          text: !ncIsNaN(value) ? formatPercentage(value, Math.min(meta.precision, 2)) : '',
          textAlign: 'left',
          maxWidth: Math.max(0, x + width - padding - labelX),
          fontFamily: `${pv ? 600 : 500} 12px Inter`,
          fillStyle: pv ? getColor(themeV4Colors.brand['500']) : getColor(textColor),
          height,
        })

        return
      }

      const barHeight = 4
      const barY = y + 14

      const { width: labelWidth } = renderSingleLineText(ctx, {
        x: x + width - padding,
        y,
        text: !ncIsNaN(value) ? formatPercentage(value, Math.min(meta.precision, 2)) : '',
        textAlign: 'right',
        maxWidth: width - padding * 2,
        fontFamily: `${pv ? 600 : 500} 13px Inter`,
        fillStyle: pv ? getColor(themeV4Colors.brand['500']) : getColor(textColor),
        height,
        render: false,
      })

      const barWidth = (width - padding * 2 - labelWidth - 4) * (percent / 100)

      roundedRect(ctx, x + padding, barY, width - padding * 2 - labelWidth - 4, barHeight, barHeight / 2, {
        backgroundColor: getColor('#E5E5E5', 'var(--nc-bg-brand-inverted)'),
      })

      if (percent !== 0) {
        roundedRect(ctx, x + padding, barY, barWidth, barHeight, barHeight / 2, {
          backgroundColor: getColor(themeV4Colors.brand['500']),
        })
      }

      renderSingleLineText(ctx, {
        x: x + width - padding,
        y,
        text: !ncIsNaN(value) ? formatPercentage(value, Math.min(meta.precision, 2)) : '',
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
      text: value !== null && typeof value !== 'undefined' && value !== '' ? `${formatPercentage(value, meta.precision)}` : '',
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
