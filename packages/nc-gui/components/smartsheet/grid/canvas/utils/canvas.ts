import { LRUCache } from 'lru-cache'
import type { SpriteLoader } from '../loaders/SpriteLoader'
import type { RenderSingleLineTextProps, RenderTagProps } from './types'

const singleLineTextCache: LRUCache<string, { text: string; width: number }> = new LRUCache({
  max: 1000,
})

export const truncateText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number) => {
  if (!text || ctx.measureText(text).width <= maxWidth) {
    return text
  }

  let truncated = text
  while (ctx.measureText(`${truncated}...`).width > maxWidth && truncated.length > 0) {
    truncated = truncated.slice(0, -1)
  }
  return `${truncated}...`
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

    ctx.strokeStyle = '#E5E7EB'
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

    ctx.strokeStyle = '#D1D5DB'
    ctx.lineWidth = 1
    ctx.stroke()
  }
}

export const renderSingleLineText = (ctx: CanvasRenderingContext2D, params: RenderSingleLineTextProps) => {
  const {
    x = 0,
    y = 0,
    text,
    fillStyle,
    fontSize = 13,
    fontFamily,
    textAlign = 'left',
    verticalAlign = 'middle',
    render = true,
  } = params
  let { maxWidth = Infinity } = params

  if (maxWidth < 0) {
    maxWidth = 0
  }

  let truncatedText = ''
  let width = 0

  const cacheKey = `${text}-${fontFamily}-${maxWidth}`
  const cachedText = singleLineTextCache.get(cacheKey)

  if (cachedText) {
    truncatedText = cachedText.text
    width = cachedText.width
  } else if (maxWidth === Infinity || !text || ctx.measureText(text).width <= maxWidth) {
    truncatedText = text
    width = ctx.measureText(truncatedText).width

    singleLineTextCache.set(cacheKey, { text: truncatedText, width })
  } else {
    truncatedText = text
    while (ctx.measureText(`${truncatedText}...`).width > maxWidth && truncatedText.length > 0) {
      truncatedText = truncatedText.slice(0, -1)
    }

    truncatedText = ctx.direction === 'rtl' ? `...${truncatedText}` : `${truncatedText}...`

    // width = Math.min(ctx.measureText(truncatedText).width, maxWidth)
    width = ctx.measureText(truncatedText).width

    singleLineTextCache.set(cacheKey, { text: truncatedText, width })
  }

  if (render) {
    const yOffset = verticalAlign === 'middle' ? fontSize / 2 : 0

    if (fontFamily) {
      ctx.font = fontFamily
    }

    if (fillStyle) {
      ctx.fillStyle = fillStyle
      ctx.strokeStyle = fillStyle
    }

    ctx.textAlign = textAlign
    ctx.textBaseline = verticalAlign
    ctx.fillText(truncatedText, x, y + yOffset)
  }

  return { text: truncatedText, width }
}

export const renderTag = (ctx: CanvasRenderingContext2D, { x, y, height, width, fillStyle, radius }: RenderTagProps) => {
  if (width < 0) {
    width = 0
  }
  ctx.fillStyle = fillStyle
  ctx.beginPath()
  ctx.roundRect(x, y, width, height, radius)
  ctx.fill()
}
