import { truncateText } from '../utils/canvas'

export const GeoDataCellRenderer: CellRenderer = {
  render: (ctx, { value, x, y, width, height, selected, pv, readonly, padding }) => {
    ctx.font = `${pv ? 600 : 500} 13px Manrope`
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'

    const [latitude, longitude] = (value || '').split(';')
    const isLocationSet = !!(latitude && longitude)
    const displayText = isLocationSet ? `${latitude}; ${longitude}` : 'Set location'
    const textY = y + height / 2

    if (!isLocationSet && !readonly) {
      // Draw location button
      const buttonWidth = Math.min(width - padding * 2, 256)
      const buttonX = x + (width - buttonWidth) / 2

      // Button background
      ctx.fillStyle = selected ? '#eef2ff' : '#f3f4f6'
      ctx.fillRect(buttonX, y + 2, buttonWidth, height - 4)

      // Map marker icon
      ctx.fillStyle = selected ? '#3366FF' : '#6b7280'
      ctx.font = '12px Material Icons'
      ctx.fillText('place', buttonX + padding, textY)

      // Button text
      ctx.font = `${pv ? 600 : 500} 13px Manrope`
      ctx.fillStyle = selected ? '#3366FF' : '#6b7280'
      const iconWidth = ctx.measureText('place').width
      ctx.fillText(displayText, buttonX + padding + iconWidth + 6, textY)
    } else {
      // Draw normal text
      const maxWidth = width - padding * 2
      const truncatedText = truncateText(ctx, displayText, maxWidth)
      ctx.fillStyle = selected || pv ? '#3366FF' : '#4a5268'
      ctx.fillText(truncatedText, x + padding, textY)
    }
  },
}
