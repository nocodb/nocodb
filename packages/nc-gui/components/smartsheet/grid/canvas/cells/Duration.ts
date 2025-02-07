import { renderSingleLineText, renderTagLabel } from '../utils/canvas'

export const DurationCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const { column, value, x, y, width, height, pv, padding, textColor = '#4a5268' } = props

    if (!isValidValue(value)) {
      return {
        x,
        y,
      }
    }

    const durationType = parseProp(column?.meta)?.duration || 0
    const text = convertMS2Duration(value, durationType)

    if (props.tag?.renderAsTag) {
      return renderTagLabel(ctx, { ...props, text })
    } else {
      const { x: xOffset, y: yOffset } = renderSingleLineText(ctx, {
        x: x + width - padding,
        y,
        textAlign: 'right',
        text,
        maxWidth: width - padding * 2,
        fontFamily: `${pv ? 600 : 500} 13px Manrope`,
        fillStyle: pv ? '#4351e8' : textColor,
        height,
      })

      return {
        x: xOffset,
        y: yOffset,
      }
    }
  },
  async handleKeyDown(ctx) {
    const { e, row, column, updateOrSaveRow, makeCellEditable } = ctx
    const columnObj = column.columnObj

    if (/^[0-9]$/.test(e.key) && isTypableInputColumn(columnObj) && columnObj.title) {
      const meta = typeof columnObj.meta === 'string' ? JSON.parse(columnObj.meta) : columnObj.meta
      const durationType = meta?.duration || 0

      const currentDisplay = convertMS2Duration(row.row[columnObj.title], durationType)

      const newDisplayValue = currentDisplay ? `${currentDisplay}${e.key}` : e.key

      const res = convertDurationToSeconds(newDisplayValue, durationType)

      if (res._isValid) {
        row.row[columnObj.title] = res._sec
        makeCellEditable(row, column)
        await updateOrSaveRow(row, columnObj.title)
        return true
      }
    }

    return false
  },
}
