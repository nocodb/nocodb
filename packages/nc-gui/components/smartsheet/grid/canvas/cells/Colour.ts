import { ColumnHelper, UITypes } from 'nocodb-sdk'
import { renderTag } from '../utils/canvas'

export const ColourCellRenderer: CellRenderer = {
  render(ctx: CanvasRenderingContext2D, props: CellRendererOptions) {
    const {
      value,
      x,
      y,
      width,
      height,
      column,
      padding = 10,
      readonly,
      tag = {},
      setCursor,
      mousePosition,
      selected,
      isRowHovered,
      getColor,
      isUnderLookup,
    } = props

    const {
      renderAsTag,
      tagPaddingX = 6,
      tagHeight = 20,
      tagRadius = 6,
      tagBgColor = getColor('#f4f4f0', themeV4Colors.base.white),
      tagSpacing = 4,
      tagBorderColor,
      tagBorderWidth,
    } = tag

    // Get column metadata with defaults
    const columnMeta = {
      ...ColumnHelper.getColumnDefaultMeta(UITypes.Colour),
      ...parseProp(column?.meta),
    }

    // Parse and validate the color value
    const colorValue = value ? String(value).trim() : null
    const isValidColor = colorValue && /^#[0-9A-Fa-f]{6}$/.test(colorValue)
    const displayColor = isValidColor ? colorValue : columnMeta.color || '#3366FF'

    // Don't render anything if no value and not hovered/selected
    if (!colorValue && !isRowHovered && !selected && !renderAsTag) {
      return
    } else if ((isRowHovered || selected) && !colorValue && readonly && !renderAsTag) {
      return
    }

    // Calculate swatch size based on configuration
    const swatchSizeMap = {
      small: 16,
      medium: 20,
      large: 24,
    }
    const swatchSize = swatchSizeMap[columnMeta.swatchSize] || 20
    const borderRadius = columnMeta.swatchStyle === 'circle' ? swatchSize / 2 : 3

    // Calculate positions
    const swatchX = x + padding
    const swatchY = y + (height - swatchSize) / 2
    const hexTextX = swatchX + swatchSize + 8
    const hexTextY = y + height / 2

    // Set cursor to pointer when hovering over the cell (for editing)
    if (mousePosition && !readonly) {
      const isHovered = 
        mousePosition.x >= x && 
        mousePosition.x <= x + width && 
        mousePosition.y >= y && 
        mousePosition.y <= y + height
      
      if (isHovered) {
        setCursor('pointer')
      }
    }

    if (renderAsTag) {
      let tagWidth = swatchSize + tagPaddingX * 2
      
      // Add space for hex code if display format includes it
      if (colorValue && (columnMeta.displayFormat === 'swatch_and_hex' || columnMeta.displayFormat === 'hex_only')) {
        const hexText = colorValue.toUpperCase()
        ctx.font = '12px Inter'
        const hexTextWidth = ctx.measureText(hexText).width
        tagWidth = columnMeta.displayFormat === 'hex_only' 
          ? hexTextWidth + tagPaddingX * 2 
          : swatchSize + 8 + hexTextWidth + tagPaddingX * 2
      }

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

      // Render content inside tag
      if (colorValue || isUnderLookup) {
        let contentX = x + tagSpacing + tagPaddingX

        if (columnMeta.displayFormat !== 'hex_only') {
          // Render color swatch
          ctx.fillStyle = displayColor
          ctx.beginPath()
          if (columnMeta.swatchStyle === 'circle') {
            ctx.arc(contentX + swatchSize / 2, initialY + tagHeight / 2, swatchSize / 2, 0, 2 * Math.PI)
          } else {
            ctx.roundRect(contentX, initialY + (tagHeight - swatchSize) / 2, swatchSize, swatchSize, borderRadius)
          }
          ctx.fill()

          // Add border to swatch
          ctx.strokeStyle = getColor('#d0d5dd', themeV4Colors.gray['300'])
          ctx.lineWidth = 1
          ctx.stroke()

          contentX += swatchSize + 8
        }

        if (columnMeta.displayFormat !== 'swatch_only' && colorValue) {
          // Render hex code text
          ctx.font = '12px Inter'
          ctx.fillStyle = getColor(themeV4Colors.gray['600'])
          ctx.textBaseline = 'middle'
          ctx.textAlign = 'left'
          ctx.fillText(colorValue.toUpperCase(), contentX, initialY + tagHeight / 2)
        }
      }

      return {
        x: x + tagWidth + tagSpacing,
        y: y + tagHeight + tagSpacing,
      }
    } else {
      // Regular cell rendering
      if (colorValue || isRowHovered || selected) {
        let contentX = swatchX

        if (columnMeta.displayFormat !== 'hex_only') {
          // Render color swatch
          ctx.fillStyle = displayColor
          ctx.beginPath()
          if (columnMeta.swatchStyle === 'circle') {
            ctx.arc(contentX + swatchSize / 2, swatchY + swatchSize / 2, swatchSize / 2, 0, 2 * Math.PI)
          } else {
            ctx.roundRect(contentX, swatchY, swatchSize, swatchSize, borderRadius)
          }
          ctx.fill()

          // Add border to swatch
          ctx.strokeStyle = getColor('#d0d5dd', themeV4Colors.gray['300'])
          ctx.lineWidth = 1
          ctx.stroke()

          contentX = hexTextX
        }

        if (columnMeta.displayFormat !== 'swatch_only' && colorValue) {
          // Render hex code text
          ctx.font = '12px Inter'
          ctx.fillStyle = getColor(themeV4Colors.gray['600'])
          ctx.textBaseline = 'middle'
          ctx.textAlign = 'left'
          ctx.fillText(colorValue.toUpperCase(), contentX, hexTextY)
        }
      }
    }
  },

  async handleClick({ mousePosition, column, row, readonly, formula, updateOrSaveRow, path }) {
    if (!row || !column || readonly || formula || !column.isCellEditable || column.isSyncedColumn) return false

    // Open color picker (this would typically trigger a modal or dropdown)
    // For now, we'll just demonstrate that the click is handled
    return false
  },

  async handleKeyDown(ctx) {
    const { e, row, column, readonly } = ctx
    if (column.readonly || readonly || !column.isCellEditable || column.isSyncedColumn) return

    // Handle common color shortcuts (could be extended)
    if (e.key === 'Delete' || e.key === 'Backspace') {
      row.row[column.title] = null
      try {
        await ctx.updateOrSaveRow(row, column.title, undefined, undefined, undefined, ctx.path)
      } catch (e: any) {
        message.error(await extractSdkResponseErrorMsg(e))
      }
      return true
    }

    return false
  },
}