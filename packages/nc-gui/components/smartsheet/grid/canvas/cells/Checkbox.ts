export const CheckboxCellRenderer: CellRenderer = {
  render: async (ctx, { value, x, y, width, readonly, column, spriteLoader }) => {
    const checked = !!value && value !== '0' && value !== 0 && value !== 'false'

    const columnMeta = {
      color: 'primary',
      ...parseProp(column.meta),
      icon: extractCheckboxIcon(column?.meta ?? {}),
    }

    if (readonly && !checked) return

    spriteLoader.renderIcon(ctx, {
      icon: checked ? columnMeta.icon.checked : columnMeta.icon.unchecked,
      size: 14,
      x: x + width / 2 - 7,
      y: y + 8,
      color: columnMeta.color,
    })
  },
}
