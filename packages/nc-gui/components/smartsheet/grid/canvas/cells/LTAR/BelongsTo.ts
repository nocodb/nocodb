import { isBoxHovered } from '../../utils/canvas'

export const BelongsToCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const { x, y, width, height, spriteLoader, mousePosition } = props

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
