import type { SpriteLoader } from '../loaders/SpriteLoader'

import type { RenderSingleLineTextProps } from './types'

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
    x,
    y,
    text,
    fillStyle,
    fontSize = 13,
    fontFamily,
    textAlign = 'left',
    verticalAlign = 'middle',
    maxWidth = Infinity,
    height,
  } = params

  const truncatedText = maxWidth !== Infinity ? truncateText(ctx, text, maxWidth) : text

  const yOffset = verticalAlign === 'middle' ? height / 2 : 0

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
