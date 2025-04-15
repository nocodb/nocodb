import type { ColumnType, TableType } from 'nocodb-sdk'
import { isBoxHovered } from '../../utils/canvas'
import { PlainCellRenderer } from '../Plain'
import { renderAsCellLookupOrLtarValue } from '../../utils/cell'

export const OneToOneCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const {
      value,
      x,
      y,
      width,
      height,
      spriteLoader,
      mousePosition,
      row,
      column,
      relatedTableMeta,
      renderCell,
      readonly,
      setCursor,
      selected,
      cellRenderStore,
    } = props

    const hasValue = !!row[column.title!]

    const relatedTableDisplayValueProp =
      (relatedTableMeta?.columns?.find((c) => c.pv) || relatedTableMeta?.columns?.[0])?.title || ''

    const relatedTableDisplayValuePropId =
      (relatedTableMeta?.columns?.find((c) => c.pv) || relatedTableMeta?.columns?.[0])?.id || ''

    const ooColumn = relatedTableMeta?.columns?.find((c: any) => c.title === relatedTableDisplayValueProp) as
      | ColumnType
      | undefined

    if (!ooColumn) return
    let returnData
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

      returnData = cellRenderer({
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

      if (!returnData?.x || !returnData?.y) return

      /**
       * x, y, width, height is required when user click on chip item to expand record
       */
      Object.assign(returnData, {
        width: returnData.x - x + 4,
        height: returnData.y - (y + (rowHeightInPx['1'] === height ? 0 : 2)),
      })

      Object.assign(cellRenderStore, returnData)

      // Show cursor pointer on hover over chip item
      if (
        !readonly &&
        selected &&
        isBoxHovered(
          {
            x: x + 4,
            y: y + (rowHeightInPx['1'] === height ? 0 : 2),
            height: cellRenderStore.height!,
            width: cellRenderStore.width!,
          },
          mousePosition,
        )
      ) {
        setCursor('pointer')
      }

      if (selected && !readonly) {
        spriteLoader.renderIcon(ctx, {
          x: returnData.x + 2,
          y: y + (rowHeightInPx['1'] === height ? 8 : 10),
          icon: 'ncXCircle',
          size: 14,
          color: '#AFB3C2',
        })

        if (
          isBoxHovered(
            { x: returnData.x + 2, y: y + (rowHeightInPx['1'] === height ? 8 : 10), height: 14, width: 14 },
            mousePosition,
          )
        ) {
          setCursor('pointer')
        }
      }
    }

    if (isBoxHovered({ x, y, width, height }, mousePosition) && !readonly) {
      const btnSize = hasValue ? 16 : 14
      spriteLoader.renderIcon(ctx, {
        x: x + width - (hasValue ? 27 : 26),
        y: y + (hasValue ? 7 : 8),
        icon: hasValue ? 'maximize' : 'ncPlus',
        size: btnSize,
        color: '#374151',
      })

      if (
        isBoxHovered(
          { x: x + width - (hasValue ? 27 : 26), y: y + (hasValue ? 7 : 8), height: btnSize, width: btnSize },
          mousePosition,
        )
      ) {
        setCursor('pointer')
      }
    }

    return returnData
  },
  async handleClick({
    row,
    value,
    column,
    getCellPosition,
    mousePosition,
    makeCellEditable,
    cellRenderStore,
    selected,
    isPublic,
    readonly,
    isDoubleClick,
    openDetachedExpandedForm,
  }) {
    const rowIndex = row.rowMeta.rowIndex!
    const { x, y, width, height } = getCellPosition(column, rowIndex)
    const hasValue = !!row.row[column.title!]
    const size = hasValue ? 16 : 14

    /**
     * Note: The order of click action trigger is matter here to mimic behaviour of editable cell
     */

    /**
     * 1. When user clicks on Maximize/Plus icon make cell editable
     *    Open linked/unlinked record dropdown will handled in editable cell component
     *
     * 2. On click remove icon (cross) make cell editable
     *    Remove item on click cross in handled in editable cell component
     */

    const isClickedOnMaximizeOrPlusIcon = isBoxHovered(
      { x: x + width - (hasValue ? 27 : 26), y: y + (hasValue ? 7 : 8), height: size, width: size },
      mousePosition,
    )

    const isClickedOnXCircleIcon =
      cellRenderStore?.x &&
      selected &&
      isBoxHovered({ x: cellRenderStore.x + 2, y: y + 8, height: size, width: size }, mousePosition)

    if (isClickedOnMaximizeOrPlusIcon || isClickedOnXCircleIcon) {
      makeCellEditable(row, column)
      return true
    }

    /**
     * Expand record on click chip item if cell is selected and user has permission to edit data (e.g, not readonly)
     */
    if (
      (selected || isDoubleClick) &&
      ncIsObject(value) &&
      cellRenderStore?.height &&
      cellRenderStore?.width &&
      isBoxHovered(
        {
          x: x + 4,
          y: y + (rowHeightInPx['1'] === height ? 0 : 2),
          height: cellRenderStore.height,
          width: cellRenderStore.width,
        },
        mousePosition,
      )
    ) {
      /**
       * To mimic editable cell behaviour we added return statement here
       * If cell is readonly (stop event propagation on click chip item) `@click.stop="openExpandedForm"`
       */
      if (readonly) return true

      const rowId = extractPkFromRow(value, (column.relatedTableMeta?.columns || []) as ColumnType[])

      if (rowId) {
        openDetachedExpandedForm({
          isOpen: true,
          row: { row: value, rowMeta: {}, oldRow: { ...value } },
          meta: column.relatedTableMeta || ({} as TableType),
          rowId,
          useMetaFields: true,
          maintainDefaultViewOrder: true,
          loadRow: !isPublic,
        })
      }

      /**
       * It's imp to add return here on click chip item to stop event propagation as while cell click action is also present below
       */
      return true
    }

    /**
     * This is same as `cellClickHook`, on click cell make cell editable
     */
    if ((selected || isDoubleClick) && !readonly && isBoxHovered({ x, y, width, height }, mousePosition)) {
      makeCellEditable(row, column)
      return true
    }

    return false
  },
}
