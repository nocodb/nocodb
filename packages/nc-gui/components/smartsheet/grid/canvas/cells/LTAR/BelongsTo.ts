import type { ColumnType } from 'nocodb-sdk'
import { isBoxHovered } from '../../utils/canvas'
import { PlainCellRenderer } from '../Plain'
import { renderAsCellLookupOrLtarValue } from '../../utils/cell'

export const BelongsToCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const {
      value,
      x,
      y,
      width,
      height,
      spriteLoader,
      mousePosition,
      relatedTableMeta,
      renderCell,
      readonly,
      setCursor,
      selected,
      cellRenderStore,
    } = props

    const relatedTableDisplayValueProp =
      (relatedTableMeta?.columns?.find((c) => c.pv) || relatedTableMeta?.columns?.[0])?.title || ''

    const relatedTableDisplayValuePropId =
      (relatedTableMeta?.columns?.find((c) => c.pv) || relatedTableMeta?.columns?.[0])?.id || ''

    const btColumn = relatedTableMeta?.columns?.find((c: any) => c.title === relatedTableDisplayValueProp) as
      | ColumnType
      | undefined

    if (!btColumn) return
    let returnData

    if (isValidValue(value)) {
      const cellWidth = width - (isBoxHovered({ x, y, width, height }, mousePosition) ? 26 : 0)

      const cellValue =
        value && !Array.isArray(value) && typeof value === 'object'
          ? value[relatedTableDisplayValueProp] ?? value[relatedTableDisplayValuePropId]
          : value

      const cellRenderer = (options: CellRendererOptions) => {
        return renderAsCellLookupOrLtarValue.includes(btColumn.uidt)
          ? renderCell(ctx, btColumn, options)
          : PlainCellRenderer.render(ctx, options)
      }

      returnData = cellRenderer({
        ...props,
        value: cellValue,
        column: btColumn,
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

      Object.assign(cellRenderStore, returnData)

      if (!returnData?.x) return

      if (selected && !readonly) {
        spriteLoader.renderIcon(ctx, {
          x: returnData.x + 2,
          y: y + (rowHeightInPx['1'] === height ? 8 : 2),
          icon: 'ncXCircle',
          size: 14,
          color: '#AFB3C2',
        })

        if (
          isBoxHovered(
            { x: returnData.x + 2, y: y + (rowHeightInPx['1'] === height ? 8 : 2), height: 14, width: 14 },
            mousePosition,
          )
        ) {
          setCursor('pointer')
        }
      }
    }

    if (isBoxHovered({ x, y, width, height }, mousePosition) && !readonly) {
      spriteLoader.renderIcon(ctx, {
        x: x + width - 26,
        y: y + 8,
        icon: 'ncPlus',
        size: 14,
        color: '#374151',
      })

      if (isBoxHovered({ x: x + width - 26, y: y + 8, width: 14, height: 14 }, mousePosition)) {
        setCursor('pointer')
      }
    }

    return returnData
  },
  async handleClick({ row, column, getCellPosition, mousePosition, makeCellEditable, cellRenderStore, selected }) {
    const rowIndex = row.rowMeta.rowIndex!
    const { x, y, width } = getCellPosition(column, rowIndex)
    const size = 14
    if (isBoxHovered({ x: x + width - 26, y: y + 8, height: size, width: size }, mousePosition)) {
      makeCellEditable(rowIndex, column)
      return true
    }

    if (!cellRenderStore?.x || !selected) return false

    if (isBoxHovered({ x: cellRenderStore.x + 2, y: y + 8, height: size, width: size }, mousePosition)) {
      makeCellEditable(rowIndex, column)
      return true
    }
    return false
  },
}
