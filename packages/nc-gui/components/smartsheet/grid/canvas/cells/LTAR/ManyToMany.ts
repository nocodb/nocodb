import type { ColumnType } from 'nocodb-sdk'
import { isBoxHovered, renderIconButton } from '../../utils/canvas'
import { PlainCellRenderer } from '../Plain'

export const ManyToManyCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const { value, x, y, width, height, spriteLoader, mousePosition, relatedTableMeta, padding } = props

    const buttonSize = 24
    const borderRadius = 6

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

    // Todo: Handle non select type, attachment, checkbox, lookup cell render
    {
      let currentX = x
      let currentY = y
      let currentWidth = width

      const renderProps: CellRendererOptions = {
        ...props,
        column: m2mColumn,
        relatedColObj: undefined,
        relatedTableMeta: undefined,
        readonly: true,
        height: isAttachment(m2mColumn) ? props.height : rowHeightInPx['1']!,
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

      for (const cell of cells) {
        const point = PlainCellRenderer.render(ctx, {
          ...renderProps,
          value: cell.value,
          x: currentX,
          y: currentY,
          width: currentWidth,
        })

        if (point?.x) {
          if (point?.x >= x + width - padding * 2 - 50) {
            currentX = x
            currentWidth = width
            currentY = point?.y ? point?.y : currentY + 28
            line += 1
          } else {
            currentWidth = currentX + currentWidth - point?.x
            currentX = point?.x
          }
        } else {
          currentX = x
          currentY = currentY + 28

          currentWidth = width
          line += 1
        }

        if (line > maxLines) {
          break
        }
      }
    }

    if (isBoxHovered({ x, y, width, height }, mousePosition)) {
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
