import { isBoxHovered, renderIconButton } from '../../utils/canvas'

export const HasManyCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const { x, y, width, height, spriteLoader, mousePosition } = props

    const buttonSize = 24
    const borderRadius = 6

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
