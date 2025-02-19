import { LRUCache } from 'lru-cache'
import JsBarcode from 'jsbarcode'
import type { ColumnType } from 'nocodb-sdk'
import type { SpriteLoader } from '../loaders/SpriteLoader'
import type { RenderMultiLineTextProps, RenderSingleLineTextProps, RenderTagProps } from './types'
import { type Block, getFontForToken, parseMarkdown } from './markdownUtils'
import { NcMarkdownParser } from '~/helpers/tiptap'

const singleLineTextCache: LRUCache<string, { text: string; width: number }> = new LRUCache({
  max: 1000,
})

const multiLineTextCache: LRUCache<string, { lines: string[]; width: number }> = new LRUCache({
  max: 1000,
})

const markdownTextCache: LRUCache<string, { blocks: Block[]; width: number }> = new LRUCache({
  max: 1000,
})

const abstractTypeCache: LRUCache<string, string> = new LRUCache({
  max: 1000,
})

const barcodeCache: LRUCache<string, any> = new LRUCache({
  max: 1000,
})

export const replaceUrlsWithLinkCache: LRUCache<string, boolean | string> = new LRUCache({
  max: 1000,
})

export const formulaTextSegmentsCache: LRUCache<string, Array<{ text: string; url?: string }>> = new LRUCache({
  max: 1000,
})

/**
 * It is required to remove cache on row height change or even we can clear cache on unmount table component
 */
export const clearTextCache = () => {
  singleLineTextCache.clear()
  multiLineTextCache.clear()
  abstractTypeCache.clear()
  markdownTextCache.clear()
  barcodeCache.clear()
  replaceUrlsWithLinkCache.clear()
  formulaTextSegmentsCache.clear()
}

interface TruncateTextWithInfoType {
  text: string
  width: number
}

/**
 * Binary Search for Efficiency
 * Truncates the given text to fit within a specified width on a canvas.
 * This function uses binary search to efficiently find the optimal truncation point,
 * avoiding the inefficiency of repeatedly slicing the text character by character.
 * If the text exceeds the specified width, it will be truncated with an ellipsis ("...").
 *
 * @param ctx - The canvas rendering context used to measure the text width.
 * @param text - The text string to be truncated.
 * @param maxWidth - The maximum allowed width for the text. The text will be truncated if it exceeds this width.
 * @param withInfo - Whether to return the truncated text along with its width.
 * @returns A string containing the truncated text, with ellipsis ("...") if it doesn't fit within the maxWidth.
 */

export function truncateText(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  withInfo: true,
  addEllipsis?: boolean,
): TruncateTextWithInfoType
export function truncateText(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  withInfo?: false,
  addEllipsis?: boolean,
): string
export function truncateText(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  withInfo = false,
  addEllipsis = true,
): string | TruncateTextWithInfoType {
  text = text?.toString() ?? ''

  let testWidth = ctx.measureText(text).width

  if (!text || testWidth <= maxWidth) {
    if (withInfo) {
      return {
        width: testWidth,
        text,
      }
    }

    return text
  }

  const ellipsis = addEllipsis ? '...' : ''
  let start = 0
  let end = text.length
  let truncated = ''

  while (start < end) {
    const mid = Math.floor((start + end) / 2)
    const testText = ctx.direction === 'rtl' ? `${ellipsis}${text.slice(0, mid)}` : `${text.slice(0, mid)}${ellipsis}`
    testWidth = ctx.measureText(testText).width

    if (testWidth <= maxWidth) {
      truncated = testText // Update the truncated text
      start = mid + 1 // Try a longer text
    } else {
      end = mid // Try a shorter text
    }
  }

  // Final measurement to ensure consistency
  testWidth = ctx.measureText(truncated).width

  if (withInfo) {
    return {
      width: testWidth,
      text: truncated,
    }
  }

  return truncated
}

export function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number | { topRight?: number; bottomRight?: number; bottomLeft?: number; topLeft?: number },
  { backgroundColor, borderColor, borderWidth }: { backgroundColor?: string; borderColor?: string; borderWidth?: number } = {},
): void {
  const {
    topLeft = 0,
    topRight = 0,
    bottomRight = 0,
    bottomLeft = 0,
  } = typeof radius === 'number' ? { topLeft: radius, topRight: radius, bottomRight: radius, bottomLeft: radius } : radius

  ctx.beginPath()
  if (borderWidth) {
    ctx.lineWidth = borderWidth
  }
  ctx.moveTo(x + topLeft, y)

  // Top right corner
  ctx.lineTo(x + width - topRight, y)
  ctx.arcTo(x + width, y, x + width, y + topRight, topRight)

  // Bottom right corner
  ctx.lineTo(x + width, y + height - bottomRight)
  ctx.arcTo(x + width, y + height, x + width - bottomRight, y + height, bottomRight)

  // Bottom left corner
  ctx.lineTo(x + bottomLeft, y + height)
  ctx.arcTo(x, y + height, x, y + height - bottomLeft, bottomLeft)

  // Top left corner
  ctx.lineTo(x, y + topLeft)
  ctx.arcTo(x, y, x + topLeft, y, topLeft)

  ctx.closePath()

  if (borderColor) ctx.strokeStyle = borderColor
  ctx.stroke()

  if (backgroundColor) {
    ctx.fillStyle = backgroundColor
    ctx.fill()
  }
}

export const renderCheckbox = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  isChecked: boolean,
  isDisabled: boolean,
  spriteLoader: SpriteLoader,
  strokeColor = '#E5E7EB',
) => {
  const size = 16
  const radius = 4

  ctx.beginPath()
  ctx.roundRect(x, y, size, size, radius)

  if (isDisabled) {
    ctx.fillStyle = '#F5F5F5'
    ctx.fill()

    if (isChecked) {
      spriteLoader.renderIcon(ctx, {
        icon: 'ncCheck',
        size: 12,
        x: x + 2,
        y: y + 2,
        color: '#B8B8B8',
      })
    }

    ctx.strokeStyle = strokeColor ?? '#D9D9D9'
    ctx.lineWidth = 1
    ctx.stroke()
  } else if (isChecked) {
    ctx.fillStyle = '#4351e7'
    ctx.fill()

    const checkX = x + 3.5
    const checkY = y + 4.5
    const checkSize = 7

    ctx.strokeStyle = 'white'
    ctx.lineWidth = 2

    ctx.beginPath()
    ctx.moveTo(checkX, checkY + checkSize * 0.6)
    ctx.lineTo(checkX + checkSize * 0.35 + 0.7, checkY + checkSize)
    ctx.lineTo(checkX + checkSize + 2, checkY)
    ctx.stroke()
  } else {
    ctx.fillStyle = '#FFFFFF'
    ctx.fill()

    ctx.strokeStyle = strokeColor ?? '#D1D5DB'
    ctx.lineWidth = 1
    ctx.stroke()
  }
}

const drawUnderline = (
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  { x, y, width, fontSize = 13, strokeStyle }: { x: number; y: number; width: number; fontSize?: number; strokeStyle?: string },
) => {
  ctx.beginPath()

  ctx.moveTo(x, y + fontSize / 2)
  ctx.lineTo(x + width, y + fontSize / 2)

  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle
  }

  ctx.lineWidth = 1
  ctx.stroke()
}

const drawStrikeThrough = (
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  { x, y, width, strokeStyle }: { x: number; y: number; width: number; fontSize?: number; strokeStyle?: string },
) => {
  ctx.beginPath()

  ctx.moveTo(x, y)
  ctx.lineTo(x + width, y)

  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle
  }

  ctx.lineWidth = 1
  ctx.stroke()
}

export const renderSingleLineText = (
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  params: RenderSingleLineTextProps,
): {
  text: string
  width: number
  x: number
  y: number
} => {
  const {
    x = 0,
    y = 0,
    text,
    fillStyle,
    height,
    fontSize = 13,
    fontFamily = '500 13px Manrope',
    textAlign = 'left',
    verticalAlign = 'middle',
    render = true,
    underline,
    py = 10,
    isTagLabel = false,
  } = params
  let { maxWidth = Infinity } = params

  if (maxWidth < 0) {
    maxWidth = 0
  }

  let truncatedText = ''
  let width = 0
  const originalFontFamily = ctx.font

  if (fontFamily) {
    ctx.font = fontFamily
  }

  const cacheKey = `${text}-${fontFamily}-${maxWidth}`
  const cachedText = singleLineTextCache.get(cacheKey)

  if (cachedText) {
    truncatedText = cachedText.text
    width = cachedText.width
  } else {
    const res = truncateText(ctx, text, maxWidth, true)
    truncatedText = res.text
    width = res.width

    singleLineTextCache.set(cacheKey, { text: truncatedText, width })
  }

  const yOffset =
    verticalAlign === 'middle'
      ? height && (rowHeightInPx['1'] === height || isTagLabel)
        ? height / 2
        : fontSize / 2 + (py ?? 0)
      : py ?? 0

  if (render) {
    ctx.textAlign = textAlign
    ctx.textBaseline = verticalAlign

    if (fillStyle) {
      ctx.fillStyle = fillStyle
      ctx.strokeStyle = fillStyle
    }

    ctx.fillText(truncatedText, x, y + yOffset)

    if (underline) {
      drawUnderline(ctx, { x, y: y + yOffset, fontSize, width, strokeStyle: fillStyle })
    }
  } else {
    /**
     * Set fontFamily is required for measureText to get currect matrics and
     * it also imp to reset font style if we are not rendering text
     */
    ctx.font = originalFontFamily
  }

  return { text: truncatedText, width, x: x + width, y: y + yOffset + fontSize / 2 }
}

export const wrapTextToLines = (
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  { text, maxWidth, maxLines }: { text: string; maxWidth: number; maxLines: number },
): string[] => {
  const lines: string[] = []
  let remainingText = text

  while (remainingText.length > 0 && lines.length < maxLines) {
    let start = 0
    let end = remainingText.length
    let line = ''
    let width = 0

    // Binary search to find the maximum number of characters that fit within maxWidth
    while (start < end) {
      const mid = Math.floor((start + end) / 2)
      const testText = remainingText.slice(0, mid + 1)
      const testWidth = ctx.measureText(testText).width

      if (testWidth <= maxWidth) {
        line = testText // Store the valid part of the text
        width = testWidth
        start = mid + 1 // Try a longer line
      } else {
        end = mid // Try a shorter line
      }
    }

    // Check if the line ends in the middle of a word
    const lastSpaceIndex = line.lastIndexOf(' ')
    if (
      lastSpaceIndex !== -1 && // There is at least one space in the line
      remainingText[line.length] !== ' ' && // The line ends mid-word
      remainingText.length > line.length && // There is more text left
      lines.length < maxLines - 1 // We are not on the last line
    ) {
      // If the line ends mid-word, break at the last space
      line = line.slice(0, lastSpaceIndex)
      width = ctx.measureText(line).width
    }

    // Handle truncation with ellipsis for the last line
    if (lines.length === maxLines - 1 && remainingText.length > line.length) {
      const ellipsis = '...'
      const ellipsisWidth = ctx.measureText(ellipsis).width

      if (width + ellipsisWidth > maxWidth && line.length > 0) {
        line = truncateText(ctx, line, maxWidth - ellipsisWidth, false, false) // Truncate the line to fit within maxWidth
        width = ctx.measureText(line).width
      }

      line += ellipsis // Add ellipsis to indicate truncation
    }

    lines.push(line) // Store the current line
    remainingText = remainingText.slice(line.length).trimStart() // Remove the rendered part and trim leading spaces
  }

  return lines
}

const renderLines = (
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  {
    lines,
    x,
    y,
    textAlign: _,
    verticalAlign: _1,
    lineHeight,
    fontSize,
    fillStyle: _2,
    underline,
  }: {
    lines: string[]
    x: number
    y: number
    textAlign: CanvasTextAlign
    verticalAlign: CanvasTextBaseline
    lineHeight: number
    fontSize: number
    fillStyle?: string
    underline?: boolean
  },
) => {
  lines.forEach((line, index) => {
    const lineY = y + index * lineHeight
    ctx.fillText(line, x, lineY)

    if (underline) {
      drawUnderline(ctx, { x, y: lineY, width: ctx.measureText(line).width, fontSize })
    }
  })
}

export const renderMarkdownBlocks = (
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  {
    blocks,
    x,
    y,
    textAlign = 'left',
    verticalAlign = 'alphabetic',
    maxLines,
    maxWidth,
    lineHeight,
    fillStyle,
    mousePosition = { x: 0, y: 0 },
    cellRenderStore,
  }: {
    blocks: Block[]
    x: number
    y: number
    textAlign?: CanvasTextAlign
    verticalAlign?: CanvasTextBaseline
    maxLines?: number
    maxWidth: number
    lineHeight: number
    cellRenderStore?: CellRenderStore
    fillStyle?: string
    mousePosition?: { x: number; y: number }
  },
) => {
  if (fillStyle) {
    ctx.fillStyle = fillStyle
    ctx.strokeStyle = fillStyle
  }

  ctx.textAlign = textAlign
  ctx.textBaseline = verticalAlign

  // Save the current font so we can restore it later
  const defaultFont = ctx.font
  const baseFontSize = 13
  const fontFamily = 'Manrope'
  const defaultFillStyle = ctx.fillStyle
  const defaultStrokeStyle = ctx.strokeStyle

  const links: { x: number; y: number; width: number; height: number; url: string }[] = []

  maxLines = maxLines ?? blocks.length

  let renderedLineCount = 0

  for (const block of blocks) {
    if (renderedLineCount >= maxLines) break

    let tokens = block.tokens
    if (block.type === 'list-item') {
      tokens = [{ styles: [], value: '• ' }, ...tokens]
    } else if (block.type === 'numbered-list-item') {
      tokens = [{ styles: [], value: `${block.number}. ` }, ...tokens]
    }

    let tokenIndex = 0
    let cursorX = x
    const cursorY = y + renderedLineCount * lineHeight

    for (const token of tokens) {
      let tokenText = token.value

      ctx.font = getFontForToken(token, block.type, {
        baseFontSize,
        fontFamily,
      })
      ctx.fillStyle = defaultFillStyle
      ctx.strokeStyle = defaultStrokeStyle

      let tokenWidth = ctx.measureText(tokenText).width

      // Truncate the token if it exceeds the max width of the line
      if (cursorX + tokenWidth > x + maxWidth && tokenText.length > 0) {
        // cursorX starts at x, so we need to subtract x to get used space
        tokenText = truncateText(ctx, tokenText, maxWidth - (cursorX - x), false, false)
        tokenWidth = ctx.measureText(tokenText).width
      }

      if (token.styles.includes('link')) {
        const linkBox = {
          x: cursorX - 2,
          y: cursorY - baseFontSize / 2 - 2,
          width: tokenWidth + 4,
          height: baseFontSize + 4,
        }

        ctx.fillStyle = '#4351e7'
        ctx.strokeStyle = '#4351e7'

        const isHovered = isBoxHovered(linkBox, mousePosition)

        if (isHovered) {
          ctx.fillStyle = '#000'
          ctx.strokeStyle = '#000'
        }

        links.push({
          ...linkBox,
          url: token.url ?? '',
        })
      }

      let isTruncated = false

      // Add ellipsis if there is more text to render but we are on the last line
      if (renderedLineCount === maxLines - 1 && blocks.length > maxLines) {
        const ellipsis = '...'
        const ellipsisWidth = ctx.measureText(ellipsis).width

        if (cursorX + tokenWidth + ellipsisWidth > x + maxWidth || tokenIndex === tokens.length - 1) {
          if (cursorX + tokenWidth + ellipsisWidth > x + maxWidth && tokenText.length > 0) {
            // cursorX starts at x, so we need to subtract x to get used space
            tokenText = truncateText(ctx, tokenText, maxWidth - (cursorX - x) - ellipsisWidth, false, false)
            tokenWidth = ctx.measureText(tokenText).width
          }

          tokenText += ellipsis
          tokenWidth = ctx.measureText(tokenText).width
          isTruncated = true
        }
      }

      ctx.fillText(tokenText, cursorX, cursorY)

      if (token.styles.includes('underline') || token.styles.includes('link')) {
        drawUnderline(ctx, { x: cursorX, y: cursorY, width: tokenWidth, fontSize: baseFontSize })
      }

      if (token.styles.includes('strikethrough')) {
        drawStrikeThrough(ctx, { x: cursorX, y: cursorY, width: tokenWidth, fontSize: baseFontSize })
      }

      cursorX += tokenWidth
      tokenIndex++
      if (cursorX >= x + maxWidth) break
      if (isTruncated) break
    }

    renderedLineCount++
  }

  if (cellRenderStore) cellRenderStore.links = links

  // Restore the original font
  ctx.font = defaultFont
  ctx.fillStyle = defaultFillStyle
  ctx.strokeStyle = defaultStrokeStyle
}

export const renderMultiLineText = (
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  params: RenderMultiLineTextProps,
): {
  lines: string[]
  width: number
  x: number
  y: number
  height: number
} => {
  const {
    x = 0,
    y = 0,
    text,
    fillStyle,
    height,
    fontSize = 13, // In grid by default we have 13px font size
    lineHeight = 16, // In grid by default we have 16px line height
    fontFamily = '500 13px Manrope',
    textAlign = 'left',
    verticalAlign = 'middle',
    render = true,
    underline,
    py = 10,
  } = params
  let { maxWidth = Infinity, maxLines } = params

  if (maxWidth < 0) {
    maxWidth = 0
  }

  if (ncIsUndefined(maxLines)) {
    if (rowHeightInPx['1'] === height) {
      maxLines = 1 // Only one line if rowHeightInPx['1'] matches height
    } else if (height) {
      maxLines = Math.min(Math.floor(height / lineHeight), rowHeightTruncateLines(height)) // Calculate max lines based on height and lineHeight
    } else {
      maxLines = 1
    }
  }

  let lines: string[] = []
  let width = 0
  const originalFontFamily = ctx.font

  if (fontFamily) {
    ctx.font = fontFamily
  }

  const cacheKey = `${text}-${fontFamily}-${maxWidth}-${maxLines}`
  const cachedText = multiLineTextCache.get(cacheKey)

  if (cachedText) {
    lines = cachedText.lines
    width = cachedText.width
  } else {
    lines = wrapTextToLines(ctx, { text, maxWidth, maxLines })
    width = Math.min(Math.max(...lines.map((line) => ctx.measureText(line).width)), maxWidth)

    multiLineTextCache.set(cacheKey, { lines, width })
  }

  const yOffset =
    verticalAlign === 'middle' ? (height && rowHeightInPx['1'] === height ? height / 2 : fontSize / 2 + (py ?? 0)) : py ?? 0

  if (render) {
    ctx.textAlign = textAlign
    ctx.textBaseline = verticalAlign

    if (fillStyle) {
      ctx.fillStyle = fillStyle
      ctx.strokeStyle = fillStyle
    }
    // Render the text lines
    renderLines(ctx, { lines, x, y: y + yOffset, textAlign, verticalAlign, lineHeight, fontSize, fillStyle, underline })
  } else {
    /**
     * Set fontFamily is required for measureText to get currect matrics and
     * it also imp to reset font style if we are not rendering text
     */
    ctx.font = originalFontFamily
  }
  const newY = y + yOffset + (lines.length - 1) * lineHeight
  return { lines, width, x: x + width, y: newY, height: newY - y }
}

export function renderBarcode(
  ctx: CanvasRenderingContext2D,
  {
    x,
    y,
    width,
    height,
    column,
    value,
    renderAsTag = false,
    spriteLoader,
  }: {
    x: number
    y: number
    width: number
    height: number
    column: ColumnType
    value: string
    renderAsTag?: boolean
    spriteLoader: SpriteLoader
  },
) {
  if (!value) return

  const padding = 4

  const meta = parseProp(column?.meta)
  const format = meta.barcodeFormat || 'CODE128'

  const cacheKey = `${value}-${format}-${width}-${height}`

  const cachedBarcode = barcodeCache.get(cacheKey)

  let tempCanvas: HTMLCanvasElement | OffscreenCanvas

  const maxWidth = 131.2 // Max width constraint (could be a fixed value or calculated elsewhere)
  const availableWidth = Math.min(width - padding * 2, maxWidth) // Use props.width as the actual column width
  let maxHeight = height - padding * 2

  if (pxToRowHeight[height] === 1) {
    maxHeight = height - 4
  } else {
    maxHeight = height - 20
  }

  try {
    if (cachedBarcode) {
      tempCanvas = cachedBarcode
    } else {
      tempCanvas = document.createElement('canvas')

      JsBarcode(tempCanvas, value.toString(), {
        format,
        // width: 2,
        // height: height - padding * 2,
        displayValue: false,
        lineColor: '#000000',
        margin: 0,
        fontSize: 12,
        font: 'Manrope',
      })
    }

    // Calculate the aspect ratio of the generated barcode
    const aspectRatio = tempCanvas.width / tempCanvas.height

    // Determine the scaling factor based on max width and height
    const scaleFactor = Math.min(maxWidth / tempCanvas.width, maxHeight / tempCanvas.height)

    // Calculate the new width and height for the barcode
    const newWidth = tempCanvas.width * scaleFactor

    // If the width exceeds the available width, scale it down accordingly
    const finalWidth = renderAsTag ? Math.min(75, width - padding * 2) : newWidth > availableWidth ? availableWidth : newWidth

    // Calculate the final height to maintain the aspect ratio
    const finalHeight = renderAsTag ? height - padding * 2 : finalWidth / aspectRatio // Adjust the height to maintain the aspect ratio
    // Determine the xPos for centering the barcode (if not rendering as a tag)
    const xPos = renderAsTag ? x + padding : x + (width - finalWidth) / 2

    ctx.drawImage(tempCanvas, xPos, y + height / 2 - finalHeight / 2, finalWidth, finalHeight)

    barcodeCache.set(cacheKey, tempCanvas)

    return {
      x: xPos + finalWidth + 8,
      y: y + height - padding * 2,
    }
  } catch (error) {
    ctx.font = `500 13px Manrope`
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'
    ctx.fillStyle = '#4a5268'

    const { text, width: textWidth } = truncateText(ctx, value.toString(), width - padding * 2, true)

    renderMultiLineText(ctx, {
      x: x + padding * 2,
      y: y + padding,
      text,
      maxWidth: width - padding * 2 - 28,
      height,
      fontSize: 13,
      fontFamily: '500 13px Manrope',
      fillStyle: '#4a5268',
      textAlign: 'left',
    })

    spriteLoader.renderIcon(ctx, {
      icon: 'ncInfo',
      size: 16,
      color: themeV3Colors.red['400'],
      x: x + width - 16 - padding * 2,
      y: y + 9,
    })
    return {
      x: x + padding + textWidth + 4,
      y: y + height / 2 + 13,
    }
  }
}

export const renderMarkdown = (
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  params: RenderMultiLineTextProps,
): {
  width: number
  x: number
  y: number
  height: number
} => {
  const {
    x = 0,
    y = 0,
    text,
    fillStyle,
    height,
    fontSize = 13, // In grid by default we have 13px font size
    lineHeight = 16, // In grid by default we have 16px line height
    fontFamily = '500 13px Manrope',
    textAlign = 'left',
    verticalAlign = 'middle',
    render = true,
    py = 10,
    mousePosition = { x: 0, y: 0 },
    cellRenderStore,
    isTagLabel = false,
  } = params
  let { maxWidth = Infinity, maxLines } = params

  if (maxWidth < 0) {
    maxWidth = 0
  }

  if (ncIsUndefined(maxLines)) {
    if (rowHeightInPx['1'] === height || isTagLabel) {
      maxLines = 1 // Only one line if rowHeightInPx['1'] matches height
    } else if (height) {
      maxLines = Math.min(Math.floor(height / lineHeight), rowHeightTruncateLines(height)) // Calculate max lines based on height and lineHeight
    } else {
      maxLines = 1
    }
  }

  let blocks
  let width = 0
  const originalFontFamily = ctx.font

  if (fontFamily) {
    ctx.font = fontFamily
  }

  const cacheKey = `${text}-${fontFamily}-${maxWidth}-${maxLines}`
  const cachedText = markdownTextCache.get(cacheKey)

  if (cachedText) {
    width = cachedText.width
    blocks = cachedText.blocks
  } else {
    // Render 2000 characters of the text in the canvas
    const processText = text.length > 2000 ? text.slice(0, 2000) : text

    const renderText = NcMarkdownParser.preprocessMarkdown(processText, true)

    width = maxWidth
    blocks = parseMarkdown(renderText)

    markdownTextCache.set(cacheKey, { blocks, width })
  }

  const yOffset =
    verticalAlign === 'middle'
      ? height && (rowHeightInPx['1'] === height || isTagLabel)
        ? height / 2
        : fontSize / 2 + (py ?? 0)
      : py ?? 0

  if (render) {
    ctx.textAlign = textAlign
    ctx.textBaseline = verticalAlign

    if (fillStyle) {
      ctx.fillStyle = fillStyle
      ctx.strokeStyle = fillStyle
    }
    // Render the text lines
    renderMarkdownBlocks(ctx, {
      blocks,
      x,
      y: y + yOffset,
      textAlign,
      verticalAlign,
      lineHeight,
      maxLines,
      fillStyle,
      maxWidth,
      mousePosition,
      cellRenderStore,
    })
  } else {
    /**
     * Set fontFamily is required for measureText to get currect matrics and
     * it also imp to reset font style if we are not rendering text
     */
    ctx.font = originalFontFamily
  }
  const newY = y + yOffset + (blocks.length - 1) * lineHeight
  return { width, x: x + width, y: newY, height: newY - y }
}

export const renderTag = (
  ctx: CanvasRenderingContext2D,
  { x, y, height, width, fillStyle, radius, borderColor, borderWidth }: RenderTagProps,
) => {
  if (width < 0) {
    width = 0
  }
  if (fillStyle) {
    ctx.fillStyle = fillStyle
  }
  ctx.beginPath()
  ctx.roundRect(x, y, width, height, radius)
  ctx.fill()

  // Add border if borderColor and borderWidth are provided
  if (borderColor && borderWidth) {
    ctx.strokeStyle = borderColor
    ctx.lineWidth = borderWidth
    ctx.stroke()
  }
}

export const renderTagLabel = (
  ctx: CanvasRenderingContext2D,
  props: CellRendererOptions & { text: string; renderAsMarkdown?: boolean },
) => {
  const { x, y, height, width, padding, textColor = '#4a5268', mousePosition, spriteLoader, text, renderAsMarkdown } = props
  const {
    tagPaddingX = 8,
    tagHeight = 20,
    tagRadius = 6,
    tagBgColor = '#f4f4f0',
    tagSpacing = 4,
    tagBorderColor,
    tagBorderWidth,
  } = props.tag || {}

  const maxWidth = width - padding * 2 - tagPaddingX * 2

  const initialY = rowHeightInPx['1'] === height ? y + height / 2 - tagHeight / 2 : y + padding - 4

  const _renderTag = (textWidth: number) => {
    renderTag(ctx, {
      x: x + tagSpacing,
      y: initialY,
      width: textWidth + tagPaddingX * 2,
      height: tagHeight,
      radius: tagRadius,
      fillStyle: tagBgColor,
      borderColor: tagBorderColor,
      borderWidth: tagBorderWidth,
    })
  }

  if (renderAsMarkdown) {
    const { width: textWidth } = renderMarkdown(ctx, {
      x: x + tagSpacing + tagPaddingX,
      y: initialY,
      text,
      maxWidth,
      height: tagHeight,
      fontFamily: '500 13px Manrope',
      fillStyle: textColor,
      isTagLabel: true,
      mousePosition,
      spriteLoader,
      cellRenderStore: props.cellRenderStore,
      render: false,
    })

    _renderTag(textWidth)

    renderMarkdown(ctx, {
      x: x + tagSpacing + tagPaddingX,
      y: initialY,
      text,
      maxWidth,
      height: tagHeight,
      fontFamily: '500 13px Manrope',
      fillStyle: textColor,
      isTagLabel: true,
      mousePosition,
      spriteLoader,
      cellRenderStore: props.cellRenderStore,
    })

    return {
      x: x + tagSpacing + textWidth + tagPaddingX * 2,
      y: initialY + tagHeight,
    }
  } else {
    const { text: truncatedText, width: textWidth } = renderSingleLineText(ctx, {
      x: x + tagSpacing + tagPaddingX,
      y,
      text,
      maxWidth,
      fontFamily: '500 13px Manrope',
      render: false,
    })

    _renderTag(textWidth)

    renderSingleLineText(ctx, {
      x: x + tagSpacing + tagPaddingX,
      y: initialY,
      text: truncatedText,
      maxWidth,
      height: tagHeight,
      fontFamily: '500 13px Manrope',
      fillStyle: textColor,
      isTagLabel: true,
    })

    return {
      x: x + tagSpacing + textWidth + tagPaddingX * 2,
      y: initialY + tagHeight,
    }
  }
}

export const renderSpinner = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  startTime: number,
  speed = 1,
) => {
  const currentTime = Date.now()
  const elapsed = (currentTime - startTime) * speed
  const rotation = ((elapsed % 1000) / 1000) * Math.PI * 2
  const arcLength = Math.PI * 0.75 // 3/4 of a full circle
  const lineWidth = Math.max(2, size * 0.1) // Proportional line width

  ctx.save()
  ctx.translate(x, y)

  ctx.beginPath()
  ctx.arc(size / 2, size / 2, (size - lineWidth) / 2, rotation, rotation + arcLength)
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.lineCap = 'round'
  ctx.stroke()

  ctx.restore()
}

export function isBoxHovered(
  { x, y, height, width }: { x: number; y: number; height: number; width: number },
  { x: mouseX, y: mouseY }: { x: number; y: number },
) {
  return mouseX >= x && mouseX <= x + width && mouseY >= y && mouseY <= y + height
}

export function renderIconButton(
  ctx: CanvasRenderingContext2D,
  {
    buttonX,
    buttonY,
    buttonSize,
    borderRadius,
    mousePosition,
    spriteLoader,
    icon,
    iconData = {},
    background = '#ffffff',
    hoveredBackground = '#f4f4f5',
    borderColor = '#e7e7e9',
    setCursor,
    shadow = false,
  }: {
    buttonX: number
    buttonY: number
    buttonSize: number
    borderRadius: number
    spriteLoader: SpriteLoader
    icon: IconMapKey | VNode
    mousePosition?: { x: number; y: number }
    iconData?: { xOffset?: number; yOffset?: number; size?: number; color?: string }
    background?: string
    hoveredBackground?: string
    borderColor?: string
    setCursor?: SetCursorType
    shadow?: boolean
  },
) {
  const hovered = mousePosition && isBoxHovered({ x: buttonX, y: buttonY, height: buttonSize, width: buttonSize }, mousePosition)

  if (shadow) {
    ctx.save()
    ctx.shadowColor = 'rgba(0, 0, 0, 0.06)'
    ctx.shadowOffsetY = 2
    ctx.shadowBlur = 1

    roundedRect(ctx, buttonX, buttonY, buttonSize, buttonSize, borderRadius, {
      backgroundColor: hovered ? hoveredBackground : background,
      borderColor,
    })

    // Reset shadow for second layer
    ctx.shadowColor = 'rgba(0, 0, 0, 0.02)'
    ctx.shadowOffsetY = 5
    ctx.shadowBlur = 3
  }

  roundedRect(ctx, buttonX, buttonY, buttonSize, buttonSize, borderRadius, {
    backgroundColor: hovered ? hoveredBackground : background,
    borderColor,
  })

  const { color = '#374151', xOffset = 4, yOffset = 4, size: iconSize = 16 } = iconData

  spriteLoader.renderIcon(ctx, {
    icon,
    x: buttonX + xOffset,
    y: buttonY + yOffset,
    size: iconSize,
    color,
  })

  if (hovered) {
    setCursor?.('pointer')
  }
}

export const getAbstractType = (column: ColumnType, sqlUis?: Record<string, any>) => {
  if (!column || !sqlUis) return

  const cacheKey = `${column.source_id}-${column.dt}-${column.dtxp}`
  const cachedValue = abstractTypeCache.get(cacheKey)

  if (cachedValue) {
    return cachedValue
  }

  const sqlUi = column.source_id && sqlUis[column.source_id] ? sqlUis[column.source_id] : Object.values(sqlUis)[0]

  const abstractType = sqlUi.getAbstractType(column)

  abstractTypeCache.set(cacheKey, abstractType)

  return abstractType
}

export function renderFormulaURL(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  params: {
    texts: Array<{ text: string; url?: string }>
    x: number
    y: number
    maxWidth: number
    height: number
    lineHeight: number
    underlineOffset: number
  },
): { x: number; y: number; width: number; height: number; url?: string }[] {
  const { texts, x, y, maxWidth, height, lineHeight, underlineOffset } = params

  let currentX = x
  let currentY = y
  let remainingHeight = height

  const urlRects: { x: number; y: number; width: number; height: number; url: string }[] = []

  const renderText = (text: string, url?: string): void => {
    const words = text.split(' ')

    let wordCount = 0
    for (const word of words) {
      wordCount++
      const separator = wordCount === words.length ? '' : ' '
      const wordWidth = ctx.measureText(word + separator).width

      if (currentX + wordWidth > x + maxWidth) {
        currentX = x
        currentY += lineHeight
        remainingHeight -= lineHeight

        if (remainingHeight < lineHeight) {
          return // Stop rendering if out of height
        }
      }

      ctx.fillText(word + separator, currentX, currentY + lineHeight * 0.8) // Adjust vertical position

      if (url) {
        urlRects.push({
          x: currentX,
          y: currentY,
          width: wordWidth,
          height: lineHeight,
          url: url,
        })

        const underlineY = currentY + lineHeight + underlineOffset
        ctx.strokeStyle = 'black'
        ctx.beginPath()
        ctx.moveTo(currentX, underlineY)
        ctx.lineTo(currentX + wordWidth, underlineY)
        ctx.stroke()
      }

      currentX += wordWidth
    }
  }

  for (const item of texts) {
    renderText(item.text, item.url)
  }

  return urlRects
}
const offscreenCanvas = new OffscreenCanvas(0, 0)
export const defaultOffscreen2DContext = offscreenCanvas.getContext('2d')!
