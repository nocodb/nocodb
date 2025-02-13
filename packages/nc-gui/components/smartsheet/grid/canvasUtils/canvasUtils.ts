// Utility function for text truncation
import { timeFormats } from 'nocodb-sdk'

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

export const timeFormatsObj = {
  [timeFormats[0]]: 'hh:mm A',
  [timeFormats[1]]: 'hh:mm:ss A',
  [timeFormats[2]]: 'hh:mm:ss.SSS A',
}

export const timeCellMaxWidthMap = {
  [timeFormats[0]]: {
    12: 'max-w-[85px]',
    24: 'max-w-[65px]',
  },
  [timeFormats[1]]: {
    12: 'max-w-[100px]',
    24: 'max-w-[80px]',
  },
  [timeFormats[2]]: {
    12: 'max-w-[130px]',
    24: 'max-w-[110px]',
  },
}
