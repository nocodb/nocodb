import type { ColumnType } from 'nocodb-sdk'
import { isBoxHovered } from '../../utils/canvas'
import { PlainCellRenderer } from '../Plain'
import { renderAsCellLookupOrLtarValue } from '../../utils/cell'

export const OneToOneCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const { value, x, y, width, height, spriteLoader, mousePosition, row, column, relatedTableMeta, renderCell } = props

    const hasValue = !!row[column.title!]

    const relatedTableDisplayValueProp =
      (relatedTableMeta?.columns?.find((c) => c.pv) || relatedTableMeta?.columns?.[0])?.title || ''

    const relatedTableDisplayValuePropId =
      (relatedTableMeta?.columns?.find((c) => c.pv) || relatedTableMeta?.columns?.[0])?.id || ''

    const ooColumn = relatedTableMeta?.columns?.find((c: any) => c.title === relatedTableDisplayValueProp) as
      | ColumnType
      | undefined

    if (!ooColumn) return

    if (isValidValue(value)) {
      const cellWidth = width - (isBoxHovered({ x, y, width, height }, mousePosition) ? (hasValue ? 16 : 14) : 0)

      const cellValue =
        value && !Array.isArray(value) && typeof value === 'object'
          ? value[relatedTableDisplayValueProp] ?? value[relatedTableDisplayValuePropId]
          : value

      const cellRenderer = (options: CellRendererOptions) => {
        return renderAsCellLookupOrLtarValue.includes(ooColumn.uidt)
          ? renderCell(ctx, ooColumn, options)
          : PlainCellRenderer.render(ctx, options)
      }

      cellRenderer({
        ...props,
        value: cellValue,
        column: ooColumn,
        width: cellWidth,
        relatedColObj: undefined,
        relatedTableMeta: undefined,
        readonly: true,
        height: rowHeightInPx['1']!,
        padding: 10,
        textColor: themeV3Colors.brand['500'],
        tag: {
          renderAsTag: true,
          tagBgColor: themeV3Colors.brand['50'],
          tagHeight: 24,
        },
        meta: relatedTableMeta,
        x: x + 4,
        y: y + (rowHeightInPx['1'] === height ? 0 : 2),
      })
    }

    if (isBoxHovered({ x, y, width, height }, mousePosition)) {
      spriteLoader.renderIcon(ctx, {
        x: x + width - (hasValue ? 27 : 26),
        y: y + (hasValue ? 7 : 8),
        icon: hasValue ? 'maximize' : 'ncPlus',
        size: hasValue ? 16 : 14,
        color: '#374151',
      })
    }
  },
  async handleClick({ row, column, getCellPosition, mousePosition, makeCellEditable }) {
    const rowIndex = row.rowMeta.rowIndex!
    const { x, y, width } = getCellPosition(column, rowIndex)
    const hasValue = !!row.row[column.title!]
    const size = hasValue ? 16 : 14
    if (
      isBoxHovered({ x: x + width - (hasValue ? 27 : 26), y: y + (hasValue ? 7 : 8), height: size, width: size }, mousePosition)
    ) {
      makeCellEditable(rowIndex, column)
      return true
    }
    return false
  },
}
