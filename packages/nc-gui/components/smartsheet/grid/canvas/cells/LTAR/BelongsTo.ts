import type { ColumnType } from 'nocodb-sdk'
import { isBoxHovered } from '../../utils/canvas'
import { PlainCellRenderer } from '../Plain'

export const BelongsToCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const { value, x, y, width, height, spriteLoader, mousePosition, relatedTableMeta } = props

    const relatedTableDisplayValueProp =
      (relatedTableMeta?.columns?.find((c) => c.pv) || relatedTableMeta?.columns?.[0])?.title || ''

    const relatedTableDisplayValuePropId =
      (relatedTableMeta?.columns?.find((c) => c.pv) || relatedTableMeta?.columns?.[0])?.id || ''

    const ooColumn = relatedTableMeta?.columns?.find((c: any) => c.title === relatedTableDisplayValueProp) as
      | ColumnType
      | undefined

    if (!ooColumn) return

    if (isValidValue(value)) {
      const cellWidth = width - (isBoxHovered({ x, y, width, height }, mousePosition) ? 14 : 0) - 0

      const cellValue =
        value && !Array.isArray(value) && typeof value === 'object'
          ? value[relatedTableDisplayValueProp] ?? value[relatedTableDisplayValuePropId]
          : value

      // Todo: Handle non select type, attachment, checkbox, lookup cell render
      PlainCellRenderer.render(ctx, {
        ...props,
        value: cellValue,
        column: ooColumn,
        width: cellWidth,
        relatedColObj: undefined,
        relatedTableMeta: undefined,
        readonly: true,
        height: isAttachment(ooColumn) ? props.height : rowHeightInPx['1']!,
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
        x: x + width - 26,
        y: y + 8,
        icon: 'ncPlus',
        size: 14,
        color: '#374151',
      })
    }
  },
  handleClick: async () => {},
}
