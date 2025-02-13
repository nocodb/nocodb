import { isBoxHovered } from '../utils/canvas'
export const CheckboxCellRenderer: CellRenderer = {
  render: (ctx, { value, x, y, width, readonly, column, spriteLoader }) => {
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
  async handleKeyDown(ctx) {
    const { e, row, column, updateOrSaveRow } = ctx

    if (e.key === 'Enter') {
      row.row[column.title!] = !row.row[column.title!]
      await updateOrSaveRow(row, column.title)
      return true
    }

    return false
  },
  async handleClick(ctx) {
    const { row, column, updateOrSaveRow, getCellPosition, mousePosition } = ctx

    const bounds = getCellPosition(column, row.rowMeta.rowIndex!)

    const checkboxBounds = {
      x: bounds.x + bounds.width / 2 - 7,
      y: bounds.y + 8,
      width: 14,
      height: 14,
    }

    if (isBoxHovered(checkboxBounds, mousePosition)) {
      row.row[column.title!] = !row.row[column.title!]
      await updateOrSaveRow(row, column.title)
      return true
    }

    return false
  },
}
