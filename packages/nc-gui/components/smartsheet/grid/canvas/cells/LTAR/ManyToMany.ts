import type { ColumnType, TableType } from 'nocodb-sdk'
import { isBoxHovered, renderIconButton, renderSingleLineText } from '../../utils/canvas'
import { PlainCellRenderer } from '../Plain'
import { renderAsCellLookupOrLtarValue } from '../../utils/cell'

const ellipsisWidth = 15

export const ManyToManyCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const {
      value,
      x,
      y,
      width,
      height,
      readonly,
      spriteLoader,
      mousePosition,
      relatedTableMeta,
      padding,
      renderCell,
      setCursor,
      cellRenderStore,
      selected,
    } = props

    const relatedTableDisplayValueProp =
      (relatedTableMeta?.columns?.find((c) => c.pv) || relatedTableMeta?.columns?.[0])?.title || ''

    const m2mColumn = relatedTableMeta?.columns?.find((c: any) => c.title === relatedTableDisplayValueProp) as
      | ColumnType
      | undefined

    if (!m2mColumn) return

    const cells = (ncIsArray(value) ? value : []).reduce((acc, curr) => {
      if (!relatedTableDisplayValueProp) return acc

      const value = curr[relatedTableDisplayValueProp]

      acc.push({ value, item: curr })

      return acc
    }, []) as { value: any; item: Record<string, any> }[]

    const initialX = x + 4
    const initialWidth = width - 8

    let currentX = initialX
    let currentY = y + (rowHeightInPx['1'] === height ? 0 : 2)
    let currentWidth = initialWidth

    /**
     * Chip info which is oldX, oldY, x, y, width, height, value is required when user click on chip item to expand record
     * Value added in returnData because we don't want to calculate it again
     */
    const returnData: CellRenderStore['ltar'] = []

    const renderProps: CellRendererOptions = {
      ...props,
      column: m2mColumn,
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
    }

    const cellRenderer = (options: CellRendererOptions) => {
      return renderAsCellLookupOrLtarValue.includes(m2mColumn.uidt)
        ? renderCell(ctx, m2mColumn, options)
        : PlainCellRenderer.render(ctx, options)
    }

    const maxLines = rowHeightTruncateLines(height, true)
    let line = 1
    let flag = false
    const count = 1

    for (const cell of cells) {
      const point = cellRenderer({
        ...renderProps,
        value: cell.value,
        x: currentX,
        y: currentY,
        width: currentWidth,
      })

      if (point?.x) {
        // Add rendered chip info in return data
        returnData.push({
          oldX: currentX + 4,
          oldY: currentY + 4,
          x: point.x,
          y: point.y,
          width: point.x - (currentX + 4),
          height: point.y ? point.y - (currentY + 4) : 24,
          value: cell.item,
        })

        // Show cursor pointer on hover over chip item
        if (
          !readonly &&
          selected &&
          isBoxHovered(
            { x: currentX, y: currentY, width: point.x - currentX, height: point.y ? point.y - currentY : 24 },
            mousePosition,
          )
        ) {
          setCursor('pointer')
        }

        if (point?.x >= x + initialWidth - padding * 2 - (count < cells.length ? 50 - ellipsisWidth : 0)) {
          if (line + 1 > maxLines) {
            currentX = point?.x
            flag = true
            break
          }

          currentX = initialX
          currentWidth = initialWidth
          currentY = point?.y && y !== point?.y && point?.y - y >= 28 ? point?.y : currentY + 28
          line += 1
        } else {
          currentWidth = currentX + currentWidth - point?.x
          currentX = point?.x
        }
      } else {
        // Add rendered chip info in return data
        returnData.push({
          oldX: currentX,
          oldY: currentY,
          x: currentX + currentWidth,
          y: currentY + 24,
          width: currentWidth,
          height: 24,
          value: cell.item,
        })

        // Show cursor pointer on hover over chip item
        if (!readonly && selected && isBoxHovered({ x: currentX, y: currentY, width: currentWidth, height: 24 }, mousePosition)) {
          setCursor('pointer')
        }

        if (line + 1 > maxLines) {
          break
        }

        currentX = initialX
        currentY = currentY + 28

        currentWidth = initialWidth
        line += 1
      }
    }

    if (flag && count < cells.length) {
      renderSingleLineText(ctx, {
        x: currentX + 12,
        y,
        text: '...',
        maxWidth: ellipsisWidth,
        textAlign: 'right',
        verticalAlign: 'middle',
        fontFamily: '500 13px Manrope',
        fillStyle: '#666',
        height,
      })
    }

    Object.assign(cellRenderStore, { ltar: returnData })

    if (isBoxHovered({ x, y, width, height }, mousePosition)) {
      const buttonSize = 24
      const borderRadius = 6

      if (!readonly) {
        renderIconButton(ctx, {
          buttonX: x + width - 57,
          buttonY: y + 4,
          borderRadius,
          buttonSize,
          spriteLoader,
          mousePosition,
          icon: 'ncPlus',
          iconData: {
            size: 14,
            xOffset: 5,
            yOffset: 5,
          },
          setCursor,
        })
      }

      renderIconButton(ctx, {
        buttonX: x + width - 30,
        buttonY: y + 4,
        borderRadius,
        buttonSize,
        spriteLoader,
        mousePosition,
        icon: 'maximize',
        setCursor,
      })
    }
  },
  async handleClick({
    row,
    column,
    getCellPosition,
    mousePosition,
    makeCellEditable,
    cellRenderStore,
    selected,
    isPublic,
    readonly,
    isDoubleClick,
  }) {
    const rowIndex = row.rowMeta.rowIndex!
    const { x, y, width, height } = getCellPosition(column, rowIndex)
    const buttonSize = 24

    /**
     * Note: The order of click action trigger is matter here to mimic behaviour of editable cell
     */

    /**
     * When user clicks on Maximize/Plus icon make cell editable
     * Open linked/unlinked record dropdown will handled in editable cell component
     */
    if (
      isBoxHovered({ x: x + width - 57, y: y + 4, height: buttonSize, width: buttonSize }, mousePosition) ||
      isBoxHovered({ x: x + width - 30, y: y + 4, height: buttonSize, width: buttonSize }, mousePosition)
    ) {
      makeCellEditable(rowIndex, column)
      return true
    }

    if ((selected || isDoubleClick) && ncIsArray(cellRenderStore?.ltar)) {
      // Value is array of object so we have to iterate over it
      for (const cellItem of cellRenderStore.ltar) {
        /**
         * Expand record on click chip item if cell is selected and user has permission to edit data (e.g, not readonly)
         */
        if (
          ncIsObject(cellItem.value) &&
          cellItem.width &&
          cellItem.height &&
          isBoxHovered(
            {
              x: cellItem.oldX!,
              y: cellItem.oldY!,
              height: cellItem.height,
              width: cellItem.width,
            },
            mousePosition,
          )
        ) {
          /**
           * To mimic editable cell behaviour we added return statement here
           * If cell is readonly (stop event propagation on click chip item) `@click.stop="openExpandedForm"`
           */
          if (readonly) return true

          const { open } = useExpandedFormDetached()

          const rowId = extractPkFromRow(cellItem.value, (column.relatedTableMeta?.columns || []) as ColumnType[])
          if (rowId) {
            open({
              isOpen: true,
              row: { row: cellItem.value, rowMeta: {}, oldRow: { ...cellItem.value } },
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
      }
    }

    /**
     * This is same as `cellClickHook`, on click cell make cell editable
     */
    if ((selected || isDoubleClick) && isBoxHovered({ x, y, width, height }, mousePosition)) {
      makeCellEditable(rowIndex, column)
      return true
    }

    return false
  },
}
