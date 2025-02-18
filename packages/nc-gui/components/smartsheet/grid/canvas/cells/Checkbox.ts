import { isBoxHovered, renderTag } from '../utils/canvas'
export const CheckboxCellRenderer: CellRenderer = {
  render: (ctx, { value, x, y, width, height, readonly, column, spriteLoader, tag = {}, mousePosition, setCursor, formula }) => {
    height = rowHeightInPx[1]!

    const {
      renderAsTag,
      tagPaddingX = 6,
      tagHeight = 20,
      tagRadius = 6,
      tagBgColor = '#f4f4f0',
      tagSpacing = 4,
      tagBorderColor,
      tagBorderWidth,
    } = tag
    const checked = !!value && value !== '0' && value !== 0 && value !== 'false'

    const columnMeta = {
      color: 'primary',
      ...parseProp(column.meta),
      icon: extractCheckboxIcon(column?.meta ?? {}),
    }

    if (readonly && !formula && !renderAsTag) return

    if (renderAsTag) {
      const tagWidth = 14 + tagPaddingX * 2
      const initialY = y + height / 2 - tagHeight / 2
      renderTag(ctx, {
        x: x + tagSpacing,
        y: initialY,
        width: tagWidth,
        height: tagHeight,
        radius: tagRadius,
        fillStyle: tagBgColor,
        borderColor: tagBorderColor,
        borderWidth: tagBorderWidth,
      })

      checked &&
        spriteLoader.renderIcon(ctx, {
          icon: checked ? columnMeta.icon.checked : columnMeta.icon.unchecked,
          size: 14,
          x: x + tagWidth / 2 - 4,
          y: initialY + 3,
          color: columnMeta.color,
        })

      return {
        x: x + tagWidth + 8,
        y: y + tagHeight,
      }
    } else {
      const isHover = isBoxHovered({ x: x + width / 2 - 7, y: y + height / 2 - 7, width: 14, height: 14 }, mousePosition)

      if (isHover && !readonly) {
        setCursor('pointer')
      }

      spriteLoader.renderIcon(ctx, {
        icon: checked ? columnMeta.icon.checked : columnMeta.icon.unchecked,
        size: 14,
        x: x + width / 2 - 7,
        y: y + height / 2 - 7,
        color: columnMeta.color,
        alpha: checked ? 1 : isHover ? 0.7 : 0.3,
      })
    }
  },
  async handleKeyDown(ctx) {
    const { e, row, column, updateOrSaveRow, readonly } = ctx
    const columnObj = column.columnObj
    if (column.readonly || readonly) return

    if (e.key === 'Enter') {
      row.row[columnObj.title!] = !row.row[columnObj.title!]
      await updateOrSaveRow(row, columnObj.title)
      return true
    }

    return false
  },
  async handleClick(ctx) {
    const { row, column, updateOrSaveRow, getCellPosition, mousePosition, selected, readonly } = ctx
    if (column.readonly || readonly) return false

    if (selected) {
      row.row[column.title!] = !row.row[column.title!]
      await updateOrSaveRow(row, column.title)
      return true
    }

    const bounds = getCellPosition(column, row.rowMeta.rowIndex!)

    const checkboxBounds = {
      x: bounds.x + bounds.width / 2 - 7,
      y: bounds.y + bounds.height / 2 - 8,
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
