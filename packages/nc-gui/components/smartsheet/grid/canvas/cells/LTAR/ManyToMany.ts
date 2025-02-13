import type { ColumnType } from 'nocodb-sdk'
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
    }, []) as { value: any; items: Record<string, any> }[]

    const initialX = x + 4
    const initialWidth = width - 8

    let currentX = initialX
    let currentY = y + (rowHeightInPx['1'] === height ? 0 : 2)
    let currentWidth = initialWidth

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
  async handleClick({ row, column, getCellPosition, mousePosition, makeCellEditable }) {
    const rowIndex = row.rowMeta.rowIndex!
    const { x, y, width } = getCellPosition(column, rowIndex)
    const buttonSize = 24
    if (
      isBoxHovered({ x: x + width - 57, y: y + 4, height: buttonSize, width: buttonSize }, mousePosition) ||
      isBoxHovered({ x: x + width - 30, y: y + 4, height: buttonSize, width: buttonSize }, mousePosition)
    ) {
      makeCellEditable(rowIndex, column)
      return true
    }
    return false
  },
}
