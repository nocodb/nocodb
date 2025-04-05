import { FormulaDataTypes, UITypes, isNumericFieldType } from 'nocodb-sdk'
import { getAbstractType, renderSingleLineText } from '../utils/canvas'

export const NullCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const { column, sqlUis, x, y, width, height, padding, textColor = '#d5d5d9' } = props

    const isNumericField =
      isNumericFieldType(column, getAbstractType(column, sqlUis)) ||
      (column.uidt === UITypes.Formula && (column.colOptions as any)?.parsed_tree?.dataType === FormulaDataTypes.NUMERIC)

    const { x: xOffset, y: yOffset } = renderSingleLineText(ctx, {
      x: isNumericField ? x + width - padding : x + padding,
      y,
      textAlign: isNumericField ? 'right' : 'left',
      text: 'NULL',
      maxWidth: width - padding * 2,
      fontFamily: `500 13px Manrope`,
      fillStyle: textColor,
      height,
    })

    return {
      x: xOffset,
      y: yOffset,
    }
  },
}
