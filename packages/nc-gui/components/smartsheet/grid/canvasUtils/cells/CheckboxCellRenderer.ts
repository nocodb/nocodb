import type { CellRenderer } from '../useCellRenderer'

export const CheckboxCellRenderer: CellRenderer = {
  render: async (ctx, { value, x, y, width, height, readonly, column }) => {
    const checked = !!value && value !== '0' && value !== 0 && value !== 'false'

    const columnMeta = {
      color: 'primary',
      ...parseProp(column.meta),
      icon: extractCheckboxIcon(column?.meta ?? {}),
    }

    if (readonly) {
      if (!checked) {
        return
      }
      ctx.globalAlpha = 0.5

      // TODO:  Implement a Sprite Manager

      ctx.globalAlpha = 1.0
    }
  },
}
