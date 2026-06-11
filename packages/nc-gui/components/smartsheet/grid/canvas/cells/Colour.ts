import { ColumnHelper, UITypes, isValidHexColour } from 'nocodb-sdk'
import { renderTag, truncateText } from '../utils/canvas'

/** Fixed swatch size in the grid cell — matches the HTML Editor (w-4 h-4 = 16px). */
const CELL_SWATCH_SIZE = 16

/** Pixel sizes for the colour swatch when rendered as a tag (e.g. under lookup). */
const TAG_SWATCH_SIZE: Record<string, number> = {
  small: 16,
  medium: 20,
  large: 24,
}

/** Border radius for square swatches (circles use half the swatch size). */
const SQUARE_BORDER_RADIUS = 3

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

    // Don't render anything if no value
    if (!colorValue) {
      return
    }

    const isValidColor = isValidHexColour(colorValue)
    const hexDisplayText = colorValue.toUpperCase()

    const showSwatch = columnMeta.displayFormat !== 'hex_only' && isValidColor
    const showHex = columnMeta.displayFormat !== 'swatch_only'

    // Swatch size: fixed 16px in regular cells (matches HTML Editor), configurable in tags
    const tagSwatchSize = TAG_SWATCH_SIZE[columnMeta.swatchSize] || TAG_SWATCH_SIZE.medium!
    const swatchSize = CELL_SWATCH_SIZE
    const borderRadius = columnMeta.swatchStyle === 'circle' ? swatchSize / 2 : SQUARE_BORDER_RADIUS

    // Calculate positions — vertically center in default row, top-align in expanded rows
    const isDefaultRowHeight = rowHeightInPx['1'] === height
    const swatchX = x + padding
    const swatchY = isDefaultRowHeight ? y + (height - swatchSize) / 2 : y + padding
    const hexTextX = swatchX + swatchSize + 8
    const hexTextY = isDefaultRowHeight ? y + height / 2 : y + padding + swatchSize / 2

    // Set cursor to pointer when hovering over the cell
    if (mousePosition && !readonly) {
      const isHovered =
        mousePosition.x >= x && mousePosition.x <= x + width && mousePosition.y >= y && mousePosition.y <= y + height

      if (isHovered) {
        setCursor('pointer')
      }
    }

    if (renderAsTag) {
      const tagBorderRadius = columnMeta.swatchStyle === 'circle' ? tagSwatchSize / 2 : SQUARE_BORDER_RADIUS
      const showTagSwatch = columnMeta.displayFormat !== 'hex_only' && isValidColor

      // Calculate tag width based on display format
      ctx.font = '12px Inter'
      let tagWidth: number

      if (showTagSwatch && showHex) {
        const hexTextWidth = ctx.measureText(hexDisplayText).width
        tagWidth = tagSwatchSize + 8 + hexTextWidth + tagPaddingX * 2
      } else if (showHex) {
        const hexTextWidth = ctx.measureText(hexDisplayText).width
        tagWidth = hexTextWidth + tagPaddingX * 2
      } else {
        tagWidth = tagSwatchSize + tagPaddingX * 2
      }

      const initialY = isDefaultRowHeight ? y + height / 2 - tagHeight / 2 : y + padding - 4

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

        if (showTagSwatch) {
          ctx.fillStyle = colorValue
          ctx.beginPath()
          if (columnMeta.swatchStyle === 'circle') {
            ctx.arc(contentX + tagSwatchSize / 2, initialY + tagHeight / 2, tagSwatchSize / 2, 0, 2 * Math.PI)
          } else {
            ctx.roundRect(contentX, initialY + (tagHeight - tagSwatchSize) / 2, tagSwatchSize, tagSwatchSize, tagBorderRadius)
          }
          ctx.fill()

          ctx.strokeStyle = getColor('#d0d5dd', themeV4Colors.gray['300'])
          ctx.lineWidth = 1
          ctx.stroke()

          contentX += tagSwatchSize + 8
        }

        if (showHex) {
          ctx.font = '12px Inter'
          ctx.fillStyle = getColor(themeV4Colors.gray['600'])
          ctx.textBaseline = 'middle'
          ctx.textAlign = 'left'

          const maxTagTextWidth = x + tagSpacing + tagWidth - contentX - tagPaddingX
          const truncatedTagText = truncateText(ctx, hexDisplayText, maxTagTextWidth)
          ctx.fillText(truncatedTagText, contentX, initialY + tagHeight / 2)
        }
      }

      return {
        x: x + tagWidth + tagSpacing,
        y: y + tagHeight + tagSpacing,
      }
    } else {
      // Regular cell rendering
      let contentX = swatchX

      if (showSwatch) {
        ctx.fillStyle = colorValue
        ctx.beginPath()
        if (columnMeta.swatchStyle === 'circle') {
          ctx.arc(contentX + swatchSize / 2, swatchY + swatchSize / 2, swatchSize / 2, 0, 2 * Math.PI)
        } else {
          ctx.roundRect(contentX, swatchY, swatchSize, swatchSize, borderRadius)
        }
        ctx.fill()

        ctx.strokeStyle = getColor('#d0d5dd', themeV4Colors.gray['300'])
        ctx.lineWidth = 1
        ctx.stroke()

        contentX = hexTextX
      }

      if (showHex) {
        ctx.font = '12px Inter'
        ctx.fillStyle = getColor(themeV4Colors.gray['600'])
        ctx.textBaseline = 'middle'
        ctx.textAlign = 'left'

        const maxTextWidth = x + width - contentX - padding
        const truncatedText = truncateText(ctx, hexDisplayText, maxTextWidth)
        ctx.fillText(truncatedText, contentX, hexTextY)
      }
    }
  },

  async handleClick({ row, column, makeCellEditable, selected, readonly, formula }) {
    if (
      !row ||
      !column ||
      readonly ||
      formula ||
      column.readonly ||
      column.columnObj?.readonly ||
      !column.isCellEditable ||
      column.isSyncedColumn ||
      !selected
    ) {
      return false
    }

    makeCellEditable(row, column)
    return true
  },

  async handleKeyDown(ctx) {
    const { e, row, column, readonly, makeCellEditable } = ctx
    if (column.readonly || readonly || column.columnObj?.readonly || !column.isCellEditable || column.isSyncedColumn) return false

    // Open color picker on Enter
    if (e.key === 'Enter') {
      makeCellEditable(row, column)
      return true
    }

    // Handle Delete/Backspace to clear the value
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
