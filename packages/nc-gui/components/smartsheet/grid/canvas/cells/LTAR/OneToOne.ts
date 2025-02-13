import { isBoxHovered } from '../../utils/canvas'

export const OneToOneCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const { x, y, width, height, spriteLoader, mousePosition, row, column } = props

    const hasValue = !!row[column.title!]

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
  handleClick: async () => {},
}
