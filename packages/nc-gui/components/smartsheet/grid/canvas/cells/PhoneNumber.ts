import isMobilePhone from 'validator/lib/isMobilePhone'
import { UITypes } from 'nocodb-sdk'
import { renderMultiLineText, renderTagLabel } from '../utils/canvas'

export const PhoneNumberCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const { value, x, y, width, height, pv, padding, textColor = '#4a5268', selected } = props

    const text = value?.toString() ?? ''

    if (!text) {
      return {
        x,
        y,
      }
    }

    const isValid = text && isMobilePhone(text)

    if (props.tag?.renderAsTag) {
      return renderTagLabel(ctx, { ...props, text })
    } else {
      const { x: xOffset, y: yOffset } = renderMultiLineText(ctx, {
        x: x + padding,
        y,
        text,
        maxWidth: width - padding * 2,
        fontFamily: `${pv ? 600 : 500} 13px Manrope`,
        fillStyle: (isValid && selected) || pv ? '#4351e8' : textColor,
        height,
        underline: isValid,
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

    if (isTypableInputColumn(columnObj) && columnObj.title && e.key.length === 1) {
      row.row[columnObj.title] = row.row[columnObj.title] ? row.row[columnObj.title] + e.key : e.key
      makeCellEditable(row, column)
      updateOrSaveRow(row, columnObj.title)
      return true
    }

    return false
  },
}
