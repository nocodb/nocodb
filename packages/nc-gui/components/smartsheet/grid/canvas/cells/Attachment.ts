interface Attachment {
  mimetype?: string
  title?: string
}

export const AttachmentCellRenderer: CellRenderer = {
  render: (ctx, { value, x, y, width, height, imageLoader }) => {
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

    attachments.slice(0, 3).forEach((item, index) => {
      if (!item) return

      const itemX = x + padding + (itemSize + itemPadding) * index
      const itemY = y + padding

      const isImage = item.mimetype?.includes('image/') || item.title?.match(/\.(jpg|jpeg|png|gif|webp)$/i)

      if (isImage) {
        const url = getPossibleAttachmentSrc(item, 'tiny')?.[0]
        if (!url) {
          imageLoader.renderPlaceholder(ctx, itemX, itemY, itemSize, 'broken_image')
          return
        }

        const img = imageLoader.loadOrGetImage(url)
        if (img) {
          imageLoader.renderImage(ctx, img, itemX, itemY, itemSize, itemSize)
        } else {
          // imageLoader.renderPlaceholder(ctx, itemX, itemY, itemSize, 'hourglass_empty')
        }
      } else {
        imageLoader.renderPlaceholder(ctx, itemX, itemY, itemSize, '')
      }
    })

    if (attachments.length > 3) {
      const moreX = x + padding + (itemSize + itemPadding) * 3
      ctx.fillStyle = '#6b7280'
      ctx.font = '12px Manrope'
      ctx.textBaseline = 'middle'
      ctx.textAlign = 'left'
      ctx.fillText(`+${attachments.length - 3}`, moreX + padding, y + height / 2)
    }
  },
}
