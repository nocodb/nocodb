import { imageLoader } from '../loaders/ImageLoader'
import type { CellRenderer } from '~/lib/types'

const tryLoadImage = async (urls: string[]): Promise<HTMLImageElement | undefined> => {
  for (const url of urls) {
    const img = imageLoader.loadOrGetImage(url)
    if (img) return img
  }
  return undefined
}

const drawPlaceholder = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, icon: string) => {
  ctx.fillStyle = '#f3f4f6'
  ctx.beginPath()
  ctx.roundRect(x, y, size, size, 4)
  ctx.fill()

  ctx.fillStyle = '#6b7280'
  ctx.font = '12px Material Icons'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  ctx.fillText(icon, x + size / 2, y + size / 2)
}

const getFileIcon = (_mimetype?: string) => {
  // TODO: Sprite Manager
  return ''
}

const drawMoreCount = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  height: number,
  padding: number,
  itemSize: number,
  itemPadding: number,
  count: number,
) => {
  ctx.fillStyle = '#6b7280'
  ctx.font = '12px Manrope'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillText(`+${count}`, x + padding + (itemSize + itemPadding) * 3, y + height / 2)
}

interface Attachment {
  mimetype?: string
  title?: string
}

export const AttachmentCellRenderer: CellRenderer = {
  render: async (ctx, { value, x, y, width, height }) => {
    const { getPossibleAttachmentSrc } = useAttachment()
    const padding = 8
    const itemSize = height - padding * 2
    const itemPadding = 4

    let attachments: Attachment[] = []
    try {
      attachments = (typeof value === 'string' ? JSON.parse(value) : value) || []
    } catch {
      attachments = []
    }

    for (let i = 0; i < Math.min(3, attachments.length); i++) {
      const item = attachments[i]

      if (!item) return

      const itemX = x + padding + (itemSize + itemPadding) * i
      const itemY = y + padding

      const isImage = item.mimetype?.includes('image/') || item.title?.match(/\.(jpg|jpeg|png|gif|webp)$/i)

      if (isImage) {
        const urls = getPossibleAttachmentSrc(item, 'tiny')
        const img = await tryLoadImage(urls)

        if (img) {
          ctx.save()
          ctx.beginPath()
          ctx.roundRect(itemX, itemY, itemSize, itemSize, 4)
          ctx.clip()

          const scale = Math.max(itemSize / img.width, itemSize / img.height)
          const scaledWidth = img.width * scale
          const scaledHeight = img.height * scale
          const offsetX = (itemSize - scaledWidth) / 2
          const offsetY = (itemSize - scaledHeight) / 2

          ctx.drawImage(img, itemX + offsetX, itemY + offsetY, scaledWidth, scaledHeight)
          ctx.restore()
        } else {
          drawPlaceholder(ctx, itemX, itemY, itemSize, 'hourglass_empty')
        }
      } else {
        drawPlaceholder(ctx, itemX, itemY, itemSize, getFileIcon(item?.mimetype))
      }
    }

    if (attachments.length > 3) {
      drawMoreCount(ctx, x, y, height, padding, itemSize, itemPadding, attachments.length - 3)
    }
  },
}
