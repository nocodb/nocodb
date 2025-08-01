import { LRUCache } from 'lru-cache'
import JsBarcode from 'jsbarcode'
import type { ColumnType, UserType } from 'nocodb-sdk'
import type { SpriteLoader } from '../loaders/SpriteLoader'
import type { RenderMultiLineTextProps, RenderSingleLineTextProps, RenderTagProps } from './types'
import { type Block, getFontForToken, parseMarkdown } from './markdownUtils'
import { NcMarkdownParser } from '~/helpers/tiptap'

const singleLineTextCache: LRUCache<string, { text: string; width: number; isTruncated: boolean }> = new LRUCache({
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

export const rowColouringCache: LRUCache<string, RowColouringEvaluatedResultType> = new LRUCache({
  max: 1000,
})

export const aggregationCache: LRUCache<string, any> = new LRUCache({
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
  rowColouringCache.clear()
  aggregationCache.clear()
}

export const clearRowColouringCache = () => {
  rowColouringCache.clear()
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
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number | { topRight?: number; bottomRight?: number; bottomLeft?: number; topLeft?: number },
  {
    backgroundColor,
    borderColor,
    borderWidth = 1,
    borders = { top: true, right: true, bottom: true, left: true },
  }: {
    backgroundColor?: string
    borderColor?: string
    borderWidth?: number
    borders?: { top?: boolean; right?: boolean; bottom?: boolean; left?: boolean }
  } = {},
): void {
  const {
    topLeft = 0,
    topRight = 0,
    bottomRight = 0,
    bottomLeft = 0,
  } = typeof radius === 'number' ? { topLeft: radius, topRight: radius, bottomRight: radius, bottomLeft: radius } : radius

  const { top = true, right = true, bottom = true, left = true } = borders

  if (backgroundColor) {
    ctx.beginPath()
    ctx.moveTo(x + topLeft, y)
    ctx.lineTo(x + width - topRight, y)
    ctx.arcTo(x + width, y, x + width, y + topRight, topRight)
    ctx.lineTo(x + width, y + height - bottomRight)
    ctx.arcTo(x + width, y + height, x + width - bottomRight, y + height, bottomRight)
    ctx.lineTo(x + bottomLeft, y + height)
    ctx.arcTo(x, y + height, x, y + height - bottomLeft, bottomLeft)
    ctx.lineTo(x, y + topLeft)
    ctx.arcTo(x, y, x + topLeft, y, topLeft)
    ctx.closePath()
    ctx.fillStyle = backgroundColor
    ctx.fill()
  }

  if (borderColor) {
    ctx.strokeStyle = borderColor
    ctx.lineWidth = borderWidth

    if (top) {
      ctx.beginPath()
      ctx.moveTo(x + topLeft, y)
      ctx.lineTo(x + width - topRight, y)
      if (right) {
        ctx.arcTo(x + width, y, x + width, y + topRight, topRight)
      }
      ctx.stroke()
    }

    if (right) {
      ctx.beginPath()
      if (!top) {
        ctx.moveTo(x + width, y + topRight)
      } else {
        ctx.moveTo(x + width, y + topRight)
      }
      ctx.lineTo(x + width, y + height - bottomRight)
      if (bottom) {
        ctx.arcTo(x + width, y + height, x + width - bottomRight, y + height, bottomRight)
      }
      ctx.stroke()
    }

    if (bottom) {
      ctx.beginPath()
      if (!right) {
        ctx.moveTo(x + width - bottomRight, y + height)
      } else {
        ctx.moveTo(x + width - bottomRight, y + height)
      }
      ctx.lineTo(x + bottomLeft, y + height)
      if (left) {
        ctx.arcTo(x, y + height, x, y + height - bottomLeft, bottomLeft)
      }
      ctx.stroke()
    }

    if (left) {
      ctx.beginPath()
      if (!bottom) {
        ctx.moveTo(x, y + height - bottomLeft)
      } else {
        ctx.moveTo(x, y + height - bottomLeft)
      }
      ctx.lineTo(x, y + topLeft)
      if (top) {
        ctx.arcTo(x, y, x + topLeft, y, topLeft)
      }
      ctx.stroke()
    }
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
    ctx.fillStyle = '#3366FF'
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

export const drawStraightLine = (
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  {
    startX,
    startY,
    endX,
    endY,
    strokeStyle,
    lineWidth = 1,
  }: {
    startX: number
    startY: number
    endX: number
    endY: number
    strokeStyle?: string
    lineWidth?: number
  },
) => {
  ctx.beginPath()

  ctx.moveTo(startX, startY)
  ctx.lineTo(endX, endY)

  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle
  }

  ctx.lineWidth = lineWidth
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
  isTruncated: boolean
} => {
  const {
    x = 0,
    y = 0,
    text,
    fillStyle,
    height,
    fontSize = 13,
    fontFamily = '500 13px Inter',
    textAlign = 'left',
    verticalAlign = 'middle',
    render = true,
    underline,
    strikethrough,
    py = 10,
    isTagLabel = false,
  } = params
  let { maxWidth = Infinity } = params

  if (maxWidth < 0) {
    maxWidth = 0
  }

  let truncatedText = ''
  let isTruncated = false
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
    isTruncated = cachedText.isTruncated
  } else {
    const res = truncateText(ctx, text, maxWidth, true)
    truncatedText = res.text
    isTruncated = truncatedText !== text
    width = res.width
    singleLineTextCache.set(cacheKey, { text: truncatedText, width, isTruncated })
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

    if (strikethrough) {
      drawStrikeThrough(ctx, { x, y: y + yOffset, fontSize, width, strokeStyle: fillStyle })
    }
  } else {
    /**
     * Set fontFamily is required for measureText to get currect matrics and
     * it also imp to reset font style if we are not rendering text
     */
    ctx.font = originalFontFamily
  }

  return { text: truncatedText, width, x: x + width, y: y + yOffset + fontSize / 2, isTruncated }
}

export const wrapTextToLines = (
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  {
    text,
    maxWidth,
    maxLines,
    firstLineMaxWidth,
  }: { text: string; maxWidth: number; maxLines: number; firstLineMaxWidth?: number },
): string[] => {
  if (maxLines === 0) return [] // If maxLines is 0, return an empty array

  const lines: string[] = [] // Stores the wrapped lines
  let remainingText = text // Keep track of unprocessed text

  // Determine the max width for the first line
  let currentMaxWidth = firstLineMaxWidth ?? maxWidth

  while (remainingText.length > 0 && lines.length < maxLines) {
    let start = 0
    let end = remainingText.length
    let line = ''
    let width = 0

    // Binary search to find the max substring that fits within currentMaxWidth
    while (start < end) {
      const mid = Math.floor((start + end) / 2)
      const testText = remainingText.slice(0, mid + 1)
      const testWidth = ctx.measureText(testText).width

      if (testWidth <= currentMaxWidth) {
        line = testText // Store the longest valid substring
        width = testWidth
        start = mid + 1 // Try a longer substring
      } else {
        end = mid // Reduce the search space
      }
    }

    // Handle word breaking: Prevent splitting words mid-way
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

      if (width + ellipsisWidth > currentMaxWidth && line.length > 0) {
        line = truncateText(ctx, line, currentMaxWidth - ellipsisWidth, false, false) // Truncate the line to fit within maxWidth
        width = ctx.measureText(line).width
      }

      line += ellipsis // Add ellipsis to indicate truncation
    }

    lines.push(line) // Store the current line
    remainingText = remainingText.slice(line.length).trimStart() // Remove the rendered part and trim leading spaces

    // After the first line, all lines use maxWidth for consistency
    currentMaxWidth = maxWidth
  }

  return lines
}

const renderLines = (
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  {
    lines,
    x,
    y,
    startX, // Optional startX for the first line
    textAlign: _,
    verticalAlign: _1,
    lineHeight,
    fontSize,
    fillStyle: _2,
    underline,
    strikethrough,
  }: {
    lines: string[]
    x: number
    startX?: number // New parameter for first-line alignment
    y: number
    textAlign: CanvasTextAlign
    verticalAlign: CanvasTextBaseline
    lineHeight: number
    fontSize: number
    fillStyle?: string
    underline?: boolean
    strikethrough?: boolean
  },
) => {
  lines.forEach((line, index) => {
    const lineX = index === 0 && startX !== undefined ? startX : x // First line uses startX, others use x
    const lineY = y + index * lineHeight
    ctx.fillText(line, lineX, lineY)

    if (underline) {
      drawUnderline(ctx, { x: lineX, y: lineY, width: ctx.measureText(line).width, fontSize })
    }

    if (strikethrough) {
      drawStrikeThrough(ctx, { x: lineX, y: lineY, width: ctx.measureText(line).width, fontSize })
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
    fontFamily,
    height,
    selected = false,
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
    fontFamily?: string
    mousePosition?: { x: number; y: number }
    height?: number
    selected?: boolean
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
  if (!fontFamily) fontFamily = 'Inter'
  const defaultFillStyle = ctx.fillStyle
  const defaultStrokeStyle = ctx.strokeStyle

  const links: { x: number; y: number; width: number; height: number; url: string }[] = []
  const mentions: { x: number; y: number; width: number; height: number; mentionData: any }[] = []

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

    let cursorX = x
    // New block should always start on next line
    let cursorY = y + renderedLineCount * lineHeight

    /**
     * We have to render tokens as multiline text, so we have to keep track of rendered cursorX and cursorY
     */
    for (const token of tokens) {
      const tokenText = token.value

      ctx.font = getFontForToken(token, block.type, {
        baseFontSize,
        fontFamily,
      })
      ctx.fillStyle = defaultFillStyle
      ctx.strokeStyle = defaultStrokeStyle

      const maxLinesToRender = maxLines - renderedLineCount

      const isUrl = token.styles.includes('link') && !!token.url
      const isMention = token.styles.includes('mention') && !!token.mentionData

      const tokenWidth = ctx.measureText(tokenText)?.width

      let mentionTextColor = '#3366FF'

      // Handle mentions with background color and rounded rectangle
      if (isMention && token.mentionData) {
        // Check if mention will fit in current line
        const remainingWidth = maxWidth - (cursorX - x)
        const willFit = tokenWidth <= remainingWidth

        // If mention won't fit on current line, move to next line first
        if (!willFit && cursorX > x) {
          cursorX = x
          renderedLineCount++
          cursorY = y + renderedLineCount * lineHeight
        }

        const paddingX = 4
        const mentionBox = {
          x: cursorX - paddingX,
          y: cursorY - baseFontSize / 2 - 2,
          width: tokenWidth + paddingX * 2,
          height: baseFontSize + 4,
        }

        let bgColor
        if (token.mentionData.isSameUser) {
          mentionTextColor = '#17803D' // Current user text color
          bgColor = '#D4F7E0' // Current user background
        } else {
          mentionTextColor = '#3366FF' // Other user text color
          bgColor = '#EBF0FF' // Other user background
        }

        // Draw rounded rectangle background
        ctx.fillStyle = bgColor
        roundedRect(ctx, mentionBox.x, mentionBox.y, mentionBox.width, mentionBox.height, 6, {
          backgroundColor: bgColor,
          borderColor: '#ffffff00',
        })

        // Store mention data if cellRenderStore is provided
        mentions.push({
          ...mentionBox,
          mentionData: token.mentionData,
        })
      }

      const multilineTextFnProps = {
        x,
        y: cursorY,
        yOffset: 0,
        firstLineMaxWidth: cursorX !== x ? maxWidth - (cursorX - x) : undefined,
        text: tokenText,
        maxWidth,
        height,
        fillStyle: isUrl && selected ? '#3366FF' : isMention ? mentionTextColor : (defaultFillStyle as string),
        fontFamily: ctx.font,
        maxLines: isMention ? 1 : maxLinesToRender,
        underline: token.styles.includes('underline') || isUrl,
        strikethrough: token.styles.includes('strikethrough'),
      }

      // Apply extra style for link and store box info in `cellRenderStore.links`
      if (isUrl) {
        const {
          width: boxWidth,
          height: boxHeight,
          lines: linesToRender,
        } = renderMultiLineText(ctx, { ...multilineTextFnProps, render: false })

        let linkX = x

        if (linesToRender.length === 1) {
          linkX = cursorX
        }

        const linkBox = {
          x: linkX,
          y: cursorY,
          width: boxWidth,
          height: boxHeight,
        }

        const isHovered = isBoxHovered(linkBox, mousePosition)

        if (isHovered && selected) {
          multilineTextFnProps.fillStyle = '#000'
          ctx.fillStyle = '#000'
          ctx.strokeStyle = '#000'
        }

        links.push({
          ...linkBox,
          url: token.url ?? '',
        })
      }

      /**
       * Here lastLineWidth is width of last line, we will use this to render next token from same position (x + lastLineWidth)
       */
      const { lastLineWidth, lines } = renderMultiLineText(ctx, { ...multilineTextFnProps })

      let additionalLines = lines.length

      // Adjust line count if previous token was inline
      /**
       * We can't really increase renderedLineCount by lines.length as rendered token is started on existing line
       * In such case we should not count that extra line as we already counted it in previous render
       */
      if (multilineTextFnProps.firstLineMaxWidth && lines.length > 1) {
        additionalLines = Math.max(0, additionalLines - 1)
      }

      if (lines.length === 1) {
        // If lines count is 1 then we just need to move cursorX as this is rendered inline
        cursorX += lastLineWidth
        if (isMention) cursorX += 8 // Adding the padding value from your code
      } else {
        /**
         * If text is wrapped to next line then we can set cursorX to cell x + lastLineWidth
         * And then move corsorY position
         */
        cursorX = x + lastLineWidth
        renderedLineCount += additionalLines
        cursorY = y + renderedLineCount * lineHeight
      }

      /**
       * If new corsorX position is greater than equal to (maxWidth + padding)
       * Then move corsorX to cell x position and increase renderedLineCount
       */
      if (cursorX >= x + maxWidth + 10 * 2) {
        cursorX = x
        renderedLineCount += additionalLines
        cursorY = y + renderedLineCount * lineHeight
      }

      if (renderedLineCount >= maxLines) {
        break
      }
    }

    renderedLineCount++
  }

  if (cellRenderStore) {
    cellRenderStore.links = links
  }

  // Restore the original font
  ctx.font = defaultFont
  ctx.fillStyle = defaultFillStyle
  ctx.strokeStyle = defaultStrokeStyle
}

export function renderMultiLineText(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  params: RenderMultiLineTextProps,
): {
  lines: string[]
  width: number
  x: number
  y: number
  height: number
  lastLineX: number
  lastLineWidth: number
} {
  const {
    x = 0,
    y = 0,
    yOffset: yOffsetInitial,
    text,
    fillStyle,
    height,
    fontSize = 13, // In grid by default we have 13px font size
    lineHeight = 16, // In grid by default we have 16px line height
    fontFamily = '500 13px Inter',
    textAlign = 'left',
    verticalAlign = 'middle',
    render = true,
    underline,
    strikethrough,
    py = 10,
    firstLineMaxWidth, // Allows different width for the first line
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

  // Include `firstLineMaxWidth` in the cache key to avoid incorrect caching
  const cacheKey = `${text}-${fontFamily}-${maxWidth}-${maxLines}-${firstLineMaxWidth ?? 'default'}`
  const cachedText = multiLineTextCache.get(cacheKey)

  if (cachedText) {
    lines = cachedText.lines
    width = cachedText.width
  } else {
    lines = wrapTextToLines(ctx, { text, maxWidth, maxLines, firstLineMaxWidth })
    width = Math.min(Math.max(...lines.map((line) => ctx.measureText(line).width)), maxWidth)

    multiLineTextCache.set(cacheKey, { lines, width })
  }

  const yOffset =
    yOffsetInitial ??
    (verticalAlign === 'middle' ? (height && rowHeightInPx['1'] === height ? height / 2 : fontSize / 2 + (py ?? 0)) : py ?? 0)

  if (render) {
    ctx.textAlign = textAlign
    ctx.textBaseline = verticalAlign

    if (fillStyle) {
      ctx.fillStyle = fillStyle
      ctx.strokeStyle = fillStyle
    }

    const startX = !ncIsUndefined(firstLineMaxWidth) ? x + (maxWidth - firstLineMaxWidth) : undefined

    // Render the text lines
    renderLines(ctx, {
      lines,
      x,
      y: y + yOffset,
      startX,
      textAlign,
      verticalAlign,
      lineHeight,
      fontSize,
      fillStyle,
      underline,
      strikethrough,
    })
  } else {
    /**
     * Set fontFamily is required for measureText to get currect matrics and
     * it also imp to reset font style if we are not rendering text
     */
    ctx.font = originalFontFamily
  }

  const lastLineStartX = lines.length === 1 && !ncIsUndefined(firstLineMaxWidth) ? x + (maxWidth - firstLineMaxWidth) : x

  const lastLineWidth = lines.length ? Math.min(ctx.measureText(lines[lines.length - 1] ?? '').width, maxWidth) : 0

  const newY = y + yOffset + (lines.length - 1) * lineHeight

  return { lines, width, x: x + width, y: newY, height: newY - y, lastLineX: lastLineStartX + lastLineWidth, lastLineWidth }
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
        font: 'Inter',
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
      startX: xPos,
      startY: y + height / 2 - finalHeight / 2,
      width: finalWidth,
      height: finalHeight,
    }
  } catch (error) {
    ctx.font = `500 13px Inter`
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
      fontFamily: '500 13px Inter',
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
  params: RenderMultiLineTextProps & {
    baseUsers?: (Partial<UserType> | Partial<User>)[]
    user?: Partial<UserType> | Partial<User>
  },
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
    fontFamily = '500 13px Inter',
    textAlign = 'left',
    verticalAlign = 'middle',
    render = true,
    py = 10,
    mousePosition = { x: 0, y: 0 },
    cellRenderStore,
    isTagLabel = false,
    selected = false,
    baseUsers,
    user,
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
    blocks = parseMarkdown(renderText, {
      users: baseUsers,
      currentUser: user,
    })

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
      fontFamily,
      height,
      selected,
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
    tagPaddingY = 0,
    tagHeight = 20,
    tagRadius = 6,
    tagBgColor = '#f4f4f0',
    tagSpacing = 4,
    tagFontFamily = '500 13px Inter',
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
      y: initialY + tagPaddingY,
      text,
      maxWidth,
      height: tagHeight - tagPaddingY * 2,
      fontFamily: '500 13px Inter',
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
      y: initialY + tagPaddingY,
      text,
      maxWidth,
      height: tagHeight - tagPaddingY * 2,
      fontFamily: '500 13px Inter',
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
      fontFamily: tagFontFamily,
      render: false,
    })

    _renderTag(textWidth)

    renderSingleLineText(ctx, {
      x: x + tagSpacing + tagPaddingX,
      y: initialY + tagPaddingY,
      text: truncatedText,
      maxWidth,
      height: tagHeight - tagPaddingY * 2,
      fontFamily: tagFontFamily,
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
    htmlText: string
    x: number
    y: number
    maxWidth: number
    height: number
    lineHeight: number
    fillStyle?: string
    fontFamily?: string
    fontSize?: number
    textAlign?: CanvasTextAlign
    verticalAlign?: CanvasTextBaseline
  },
): { x: number; y: number; width: number; height: number; url?: string }[] {
  const { htmlText, x, y, maxWidth, height, lineHeight, fillStyle = '#4a5268' } = params

  let maxLines = 1
  if (rowHeightInPx['1'] === height) {
    maxLines = 1 // Only one line if rowHeightInPx['1'] matches height
  } else if (height) {
    maxLines = Math.min(Math.floor(height / lineHeight), rowHeightTruncateLines(height)) // Calculate max lines
  }
  const ellipsisWidth = ctx.measureText('...').width

  const urlRects: { x: number; y: number; width: number; height: number; url?: string }[] = []

  const container = document.createElement('div')
  container.innerHTML = htmlText

  let currentLine = 0
  let currentX = x
  const currentY = y
  function processNode(node: ChildNode, currentUrl?: string) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent
      if (!text) return

      // Use wrapTextToLines for better text wrapping
      const availableWidth = maxWidth - (currentX - x)

      // Calculate remaining lines
      const remainingLines = maxLines - currentLine

      // Determine first line max width based on current position
      const firstLineMaxWidth = availableWidth

      // Get wrapped lines using the new function
      const lines = wrapTextToLines(ctx, {
        text,
        maxWidth,
        maxLines: remainingLines,
        firstLineMaxWidth,
      })

      // Render each line
      for (let i = 0; i < lines.length; i++) {
        const lineText = lines[i]
        if (!lineText) continue
        const isLastLine = currentLine + i === maxLines - 1

        // Handle the first line differently, as it might not start at the beginning of the row
        if (i === 0) {
          renderLine(lineText, currentUrl, isLastLine && i === lines.length - 1 && lineText.endsWith('...'))
          currentX += ctx.measureText(lineText).width

          // If we've reached the end of the line, move to the next
          if (currentX >= x + maxWidth) {
            currentX = x
            currentLine++
          }
        } else {
          // Subsequent lines always start at the beginning of the row
          currentX = x
          currentLine++

          // Don't render if we've exceeded maxLines
          if (currentLine >= maxLines) break

          renderLine(lineText, currentUrl, isLastLine && i === lines.length - 1 && lineText.endsWith('...'))
          currentX += ctx.measureText(lineText).width
        }
      }
    } else if (node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName === 'A') {
      const anchor = node as HTMLAnchorElement
      const url = anchor.href
      node.childNodes.forEach((child) => processNode(child, url))
    } else {
      node.childNodes.forEach((child) => processNode(child, currentUrl))
    }
  }

  function truncateText(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    text: string,
    maxWidth: number,
    ellipsis: boolean,
  ): string {
    let truncated = text
    if (ctx.measureText(text).width > maxWidth) {
      truncated = text.substring(0, Math.floor(text.length * (maxWidth / ctx.measureText(text).width)))
      while (ctx.measureText(truncated + (ellipsis ? '...' : '')).width > maxWidth && truncated.length > 0) {
        truncated = truncated.slice(0, -1)
      }
      if (ellipsis) truncated += '...'
    }
    return truncated
  }

  function renderLine(text: string, url?: string, addEllipsis = false) {
    let finalText = text
    const lineY = currentY + currentLine * lineHeight + lineHeight * 0.8
    const availableWidth = maxWidth - (currentX - x)

    const textWidth = ctx.measureText(text).width

    if (textWidth > availableWidth) {
      if (addEllipsis && availableWidth >= ellipsisWidth) {
        const adjustedMaxWidth = availableWidth - ellipsisWidth // Reserve space for ellipsis
        finalText = `${truncateText(ctx, text, adjustedMaxWidth, false)}...`
      } else {
        finalText = truncateText(ctx, text, availableWidth, false) // No ellipsis
      }
    } else if (addEllipsis && textWidth + ellipsisWidth <= availableWidth) {
      finalText += '...'
    }

    ctx.fillStyle = url ? '#3366FF' : fillStyle
    ctx.fillText(finalText, currentX, lineY)

    if (url) {
      const underlineY = lineY + 8
      ctx.strokeStyle = '#3366FF'
      ctx.beginPath()
      ctx.moveTo(currentX, underlineY)
      ctx.lineTo(currentX + ctx.measureText(finalText).width, underlineY)
      ctx.stroke()

      urlRects.push({
        x: currentX,
        y: currentY + currentLine * lineHeight,
        width: ctx.measureText(finalText).width,
        height: lineHeight,
        url,
      })
    }
  }

  container.childNodes.forEach((node) => processNode(node))

  return urlRects
}

const offscreenCanvas = new OffscreenCanvas(0, 0)
export const defaultOffscreen2DContext = offscreenCanvas.getContext('2d')!
