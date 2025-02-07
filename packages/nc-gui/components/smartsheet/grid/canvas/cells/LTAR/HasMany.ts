import type { ColumnType } from 'nocodb-sdk'
import { isBoxHovered, renderIconButton, renderSingleLineText } from '../../utils/canvas'
import { PlainCellRenderer } from '../Plain'

const ellipsisWidth = 15

export const HasManyCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const { value, x, y, width, height, spriteLoader, mousePosition, relatedTableMeta, padding } = props

    const relatedTableDisplayValueProp =
      (relatedTableMeta?.columns?.find((c) => c.pv) || relatedTableMeta?.columns?.[0])?.title || ''

    const hmColumn = relatedTableMeta?.columns?.find((c: any) => c.title === relatedTableDisplayValueProp) as
      | ColumnType
      | undefined

    if (!hmColumn) return

    const cells = (ncIsArray(value) ? value : []).reduce((acc, curr) => {
      if (!relatedTableDisplayValueProp) return acc

      const value = curr[relatedTableDisplayValueProp]

      acc.push({ value, item: curr })

      return acc
    }, []) as { value: any; items: Record<string, any> }[]

    // Todo: Handle non select type, attachment, checkbox, lookup cell render

    const initialX = x + 4
    const initialWidth = width - 8

    let currentX = initialX
    let currentY = y + (rowHeightInPx['1'] === height ? 0 : 2)
    let currentWidth = initialWidth

    const renderProps: CellRendererOptions = {
      ...props,
      column: hmColumn,
      relatedColObj: undefined,
      relatedTableMeta: undefined,
      readonly: true,
      height: isAttachment(hmColumn) ? props.height : rowHeightInPx['1']!,
      padding: 10,
      textColor: themeV3Colors.brand['500'],
      tag: {
        renderAsTag: true,
        tagBgColor: themeV3Colors.brand['50'],
        tagHeight: 24,
      },
      meta: relatedTableMeta,
    }

    const maxLines = rowHeightTruncateLines(height, true)
    let line = 1
    let flag = false
    const count = 1

    for (const cell of cells) {
      const point = PlainCellRenderer.render(ctx, {
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
          currentY = point?.y ? point?.y : currentY + 28
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

      if (line > maxLines) {
        break
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
      })

      renderIconButton(ctx, {
        buttonX: x + width - 30,
        buttonY: y + 4,
        borderRadius,
        buttonSize,
        spriteLoader,
        mousePosition,
        icon: 'maximize',
      })
    }
  },
  handleClick: async () => {},
}
