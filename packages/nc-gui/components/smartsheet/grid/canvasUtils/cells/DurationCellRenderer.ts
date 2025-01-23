import { truncateText } from '../canvasUtils'
import type { CellRenderer } from '../useCellRenderer'
import { convertMS2Duration } from '~/utils/durationUtils'

export const DurationCellRenderer: CellRenderer = {
  render: (ctx, { value, x, y, width, height, selected, pv, column }) => {
    const padding = 10
    ctx.font = `${pv ? 600 : 500} 13px Manrope`
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'

    const durationType = parseProp(column?.meta)?.duration || 0
    const durationText = convertMS2Duration(value, durationType)

    const maxWidth = width - padding * 2
    const truncatedText = truncateText(ctx, durationText, maxWidth)
    const textY = y + height / 2

    ctx.fillStyle = selected || pv ? '#4351e8' : '#4a5268'
    ctx.fillText(truncatedText, x + padding, textY)
  },
}
