import { LRUCache } from 'lru-cache'
import type { SpriteLoader } from '../loaders/SpriteLoader'
import type { RenderMultiLineTextProps, RenderSingleLineTextProps, RenderTagProps } from './types'

const singleLineTextCache: LRUCache<string, { text: string; width: number }> = new LRUCache({
  max: 1000,
})

const multiLineTextCache: LRUCache<string, { lines: string[]; width: number }> = new LRUCache({
  max: 1000,
})

/**
 * It is required to remove cache on row height change or even we can clear cache on unmount table component
 */
export const clearTextCache = () => {
  singleLineTextCache.clear()
  multiLineTextCache.clear()
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
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  withInfo: true,
): TruncateTextWithInfoType
export function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, withInfo?: false): string
export function truncateText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  withInfo = false,
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

  let start = 0
  let end = text.length
  let truncated = ''

  while (start < end) {
    const mid = Math.floor((start + end) / 2)
    const testText = ctx.direction === 'rtl' ? `...${text.slice(0, mid)}` : `${text.slice(0, mid)}...`
    testWidth = ctx.measureText(testText).width

    if (testWidth <= maxWidth) {
      truncated = testText // Update the truncated text
      start = mid + 1 // Try a longer text
    } else {
      end = mid // Try a shorter text
    }
  }

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
  radius: number,
): void {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)

  // Top right corner
  ctx.lineTo(x + width - radius, y)
  ctx.arcTo(x + width, y, x + width, y + radius, radius)

  // Bottom right corner
  ctx.lineTo(x + width, y + height - radius)
  ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius)

  // Bottom left corner
  ctx.lineTo(x + radius, y + height)
  ctx.arcTo(x, y + height, x, y + height - radius, radius)

  // Top left corner
  ctx.lineTo(x, y + radius)
  ctx.arcTo(x, y, x + radius, y, radius)

  ctx.closePath()
  ctx.stroke()
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
    ctx.fillStyle = '#F3F4F6'
    ctx.fill()

    if (isChecked) {
      spriteLoader.renderIcon(ctx, {
        icon: 'ncCheck',
        size: 12,
        x: x + 2,
        y: y + 2,
        color: '#9CA3AF',
      })
    }

    ctx.strokeStyle = strokeColor ?? '#E5E7EB'
    ctx.lineWidth = 1
    ctx.stroke()
  } else if (isChecked) {
    ctx.fillStyle = '#3366FF'
    ctx.fill()

    spriteLoader.renderIcon(ctx, {
      icon: 'ncCheck',
      size: 12,
      x: x + 2,
      y: y + 2,
      color: '#FFFFFF',
    })
  } else {
    ctx.fillStyle = '#FFFFFF'
    ctx.fill()

    ctx.strokeStyle = strokeColor ?? '#D1D5DB'
    ctx.lineWidth = 1
    ctx.stroke()
  }
}

const drawUnderline = (
  ctx: CanvasRenderingContext2D,
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

export const renderSingleLineText = (
  ctx: CanvasRenderingContext2D,
  params: RenderSingleLineTextProps,
): {
  text: string
  width: number
  x?: number
  y?: number
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
  } = params
  let { maxWidth = Infinity } = params

  if (maxWidth < 0) {
    maxWidth = 0
  }

  let truncatedText = ''
  let width = 0

  if (fontFamily) {
    ctx.font = fontFamily
  }

  const cacheKey = `${text}-${fontFamily}-${maxWidth}`
  const cachedText = singleLineTextCache.get(cacheKey)

  if (cachedText) {
    truncatedText = cachedText.text
    width = cachedText.width
  } else {
    const res = truncateText(ctx, text, maxWidth, true) as TruncateTextWithInfoType
    truncatedText = res.text
    width = res.width

    singleLineTextCache.set(cacheKey, { text: truncatedText, width })
  }

  if (render) {
    const yOffset =
      verticalAlign === 'middle'
        ? height && rowHeightInPx['1'] === height
          ? height / 2
          : fontSize / 2 + (py ?? 0)
        : 0 + (py ?? 0)

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

    return { text: truncatedText, width, x: x + width, y: y + yOffset + fontSize / 2 }
  }

  return { text: truncatedText, width }
}

export const wrapTextToLines = (
  ctx: CanvasRenderingContext2D,
  { text, maxWidth, maxLines }: { text: string; maxWidth: number; maxLines: number },
): string[] => {
  const lines: string[] = []
  let remainingText = text

  while (remainingText.length > 0 && lines.length < maxLines) {
    let start = 0
    let end = remainingText.length
    let line = ''
    let width = 0

    // Binary search to find the maximum number of characters that fit in maxWidth
    while (start < end) {
      const mid = Math.floor((start + end) / 2)
      const testText = remainingText.slice(0, mid + 1)
      const testWidth = ctx.measureText(testText).width

      if (testWidth <= maxWidth) {
        line = testText // Current mid fits, so store it
        width = testWidth
        start = mid + 1 // Try a longer line
      } else {
        end = mid // Try a shorter line
      }
    }

    // Handle truncation for the last line if we hit maxLines
    if (lines.length === maxLines - 1 && remainingText.length > line.length) {
      const ellipsis = '...'
      const ellipsisWidth = ctx.measureText(ellipsis).width

      while (width + ellipsisWidth > maxWidth && line.length > 0) {
        line = line.slice(0, -1) // Remove one character at a time
        width = ctx.measureText(line).width
      }

      line += ellipsis // Add ellipsis to the last line
    }

    lines.push(line) // Add the calculated line
    remainingText = remainingText.slice(line.length) // Remove the rendered part from remaining text
  }

  return lines
}

const renderLines = (
  ctx: CanvasRenderingContext2D,
  {
    lines,
    x,
    y,
    textAlign,
    verticalAlign,
    lineHeight,
    fontSize,
    fillStyle,
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

export const renderMultiLineText = (
  ctx: CanvasRenderingContext2D,
  params: RenderMultiLineTextProps,
): {
  lines: string[]
  width: number
  x?: number
  y?: number
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
    width = Math.min(...lines.map((line) => ctx.measureText(line).width), maxWidth)

    multiLineTextCache.set(cacheKey, { lines, width })
  }

  if (render) {
    const yOffset =
      verticalAlign === 'middle'
        ? height && rowHeightInPx['1'] === height
          ? height / 2
          : fontSize / 2 + (py ?? 0)
        : 0 + (py ?? 0)

    ctx.textAlign = textAlign
    ctx.textBaseline = verticalAlign

    if (fillStyle) {
      ctx.fillStyle = fillStyle
      ctx.strokeStyle = fillStyle
    }
    // Render the text lines
    renderLines(ctx, { lines, x, y: y + yOffset, textAlign, verticalAlign, lineHeight, fontSize, fillStyle, underline })

    return { lines, width, x: x + width, y: y + yOffset + (lines.length - 1) * lineHeight }
  }

  return { lines, width }
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
