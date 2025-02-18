import { isBoxHovered, renderIconButton, roundedRect } from '../utils/canvas'
import { pxToRowHeight } from '../../../../../utils/cell'
import type { RenderRectangleProps } from '../utils/types'
import { getI18n } from '../../../../../plugins/a.i18n'

interface Attachment {
  mimetype?: string
  type?: string
  title?: string
}

function getAttachmentIcon(title?: string, mimetype?: string): string {
  if (isImage(title ?? '', mimetype)) {
    return 'ncFileTypeImage'
  }

  if (isPdf(title ?? '', mimetype)) {
    return 'ncFileTypePdf'
  }

  if (isVideo(title ?? '', mimetype)) {
    return 'ncFileTypeVideo'
  }

  if (isAudio(title ?? '', mimetype)) {
    return 'ncFileTypeAudio'
  }

  if (isWord(title ?? '', mimetype)) {
    return 'ncFileTypeWord'
  }

  if (isExcel(title ?? '', mimetype)) {
    return 'ncFileTypeCsv'
  }

  if (isPresentation(title ?? '', mimetype)) {
    return 'ncFileTypePresentation'
  }

  if (isZip(title ?? '', mimetype)) {
    return 'ncFileTypeZip'
  }

  return 'ncFileTypeUnknown'
}

function getAttachmentSize(rowHeight: number) {
  switch (rowHeight) {
    case 1:
    case 2:
      return 'tiny'
    case 4:
    case 6:
      return 'small'
    default:
      return 'tiny'
  }
}

function isImage(title?: string, mimetype?: string) {
  return mimetype?.includes('image/') || title?.match(/\.(jpg|jpeg|png|gif|webp)$/i)
}

function renderFallback(
  item: Attachment,
  {
    itemX,
    itemY,
    itemSize,
    spriteLoader,
    ctx,
  }: {
    itemX: number
    itemY: number
    itemSize: number
    spriteLoader: any
    ctx: CanvasRenderingContext2D
  },
) {
  const icon = getAttachmentIcon(item.title, item.mimetype || item.type)
  ctx.beginPath()
  ctx.roundRect(itemX, itemY, itemSize, itemSize, 4)
  ctx.strokeStyle = '#D5D5D9'
  ctx.lineWidth = 1
  ctx.stroke()

  spriteLoader.renderIcon(ctx, {
    icon,
    x: itemX,
    y: itemY,
    size: itemSize,
    color: '#6b7280',
  })
}

export const AttachmentCellRenderer: CellRenderer = {
  render: (
    ctx,
    {
      value,
      x,
      y,
      width,
      height,
      imageLoader,
      mousePosition,
      spriteLoader,
      selected,
      readonly,
      setCursor,
      isUnderLookup,
      textAlign,
    },
  ) => {
    let attachments: Attachment[] = []

    const rowHeight = pxToRowHeight[height]
    const verticalPadding = rowHeight === 1 ? 4 : 8

    try {
      attachments = (typeof value === 'string' ? JSON.parse(value) : value) || []
    } catch {
      attachments = []
    }

    if (readonly && !attachments.length) {
      return
    }

    if (selected && attachments.length === 0) {
      const buttonWidth = 86
      const buttonHeight = 24
      const buttonX = x + (width - buttonWidth) / 2
      const buttonY = y + verticalPadding

      const isButtonHovered = isBoxHovered({ x: buttonX, y: buttonY, width: buttonWidth, height: buttonHeight }, mousePosition)

      if (isButtonHovered) {
        setCursor('pointer')
      }

      roundedRect(ctx, buttonX, buttonY, buttonWidth, buttonHeight, 8, {
        backgroundColor: isButtonHovered ? '#f4f4f5' : 'white',
        borderColor: '#E7E7E9',
        borderWidth: 2,
      })

      spriteLoader.renderIcon(ctx, {
        icon: 'upload',
        x: buttonX + 8,
        y: buttonY + (buttonHeight - 16) / 2,
        size: 16,
        color: '#6a7184',
      })

      ctx.fillStyle = '#374151'
      ctx.font = '10px Manrope'
      ctx.textBaseline = 'middle'
      ctx.fillText('Add File(s)', buttonX + 28, buttonY + (buttonHeight + 2) / 2)
      return
    }

    const { getPossibleAttachmentSrc } = useAttachment()
    const horizontalPadding = 10
    const itemSize = rowHeight === 1 ? 24 : rowHeight === 2 ? 32 : 64
    const gap = 8
    const isHovered = isBoxHovered({ x, y, width, height }, mousePosition)

    const itemsPerRow = Math.floor((width - horizontalPadding * 2 + gap) / (itemSize + gap))
    const totalItems = attachments.length
    const itemsInLastRow = totalItems % itemsPerRow || itemsPerRow

    const maxRows = Math.floor((height - verticalPadding * 2 + gap) / (itemSize + gap))
    const maxVisibleItems = maxRows * itemsPerRow
    let lastX = x

    attachments.slice(0, maxVisibleItems).forEach((item, index) => {
      if (!item) return

      const row = Math.floor(index / itemsPerRow)
      const col = index % itemsPerRow

      const isLastRow = row === Math.floor((totalItems - 1) / itemsPerRow) // Last row check based on total items
      const itemsInCurrentRow = isLastRow ? itemsInLastRow : itemsPerRow

      const currentRowWidth = itemsInCurrentRow * itemSize + (itemsInCurrentRow - 1) * gap
      const rowStartX =
        isUnderLookup && textAlign !== 'center'
          ? x + horizontalPadding
          : x + horizontalPadding + Math.max(0, (width - horizontalPadding * 2 - currentRowWidth) / 2)
      const itemX = rowStartX + col * (itemSize + gap)
      const itemY = y + verticalPadding + row * (itemSize + gap)

      if (isImage(item.title, item.mimetype || item.type)) {
        const size = getAttachmentSize(rowHeight!)
        const url = getPossibleAttachmentSrc(item, size)

        if (!url?.length) {
          renderFallback(item, { itemX, itemY, itemSize, spriteLoader, ctx })
          return
        }

        const img = imageLoader.loadOrGetImage(url)
        if (img) {
          ctx.strokeStyle = '#D5D5D9'
          ctx.lineWidth = 1
          imageLoader.renderImage(ctx, img, itemX, itemY, itemSize, itemSize, 4, {
            border: true,
            borderColor: '#D5D5D9',
            borderWidth: 1,
          })
        } else {
          renderFallback(item, { itemX, itemY, itemSize, spriteLoader, ctx })
        }
      } else {
        renderFallback(item, { itemX, itemY, itemSize, spriteLoader, ctx })
      }

      lastX = itemX + itemSize

      if (!isUnderLookup && isBoxHovered({ x: itemX, y: itemY, width: itemSize, height: itemSize }, mousePosition)) {
        setCursor('pointer')
      }
    })

    if (isUnderLookup) {
      return {
        x: lastX,
        y: y + itemSize,
      }
    }

    if (!isUnderLookup && isHovered && attachments.length > 0) {
      const buttonY = y + 8

      renderIconButton(ctx, {
        buttonX: x + width - 30,
        buttonY,
        buttonSize: 18,
        borderRadius: 6,
        iconData: {
          size: 13,
          xOffset: 2.5,
          yOffset: 2.5,
        },
        mousePosition,
        spriteLoader,
        icon: 'maximize',
        setCursor,
      })

      if (readonly) return

      renderIconButton(ctx, {
        buttonX: x + 11,
        buttonY,
        buttonSize: 18,
        borderRadius: 6,
        iconData: {
          size: 13,
          xOffset: 2.5,
          yOffset: 2.5,
        },
        mousePosition,
        spriteLoader,
        icon: 'ncPaperclip',
        setCursor,
      })
    }
  },
  async handleHover({ row, column, mousePosition, getCellPosition, value, selected, imageLoader }) {
    const { tryShowTooltip, hideTooltip } = useTooltipStore()
    hideTooltip()
    if (!row || !column?.id || !mousePosition) return

    const { x, y, width, height } = getCellPosition(column, row.rowMeta.rowIndex!)

    let attachments: Attachment[] = []
    try {
      attachments = (typeof value === 'string' ? JSON.parse(value) : value) || []
    } catch {
      attachments = []
    }
    if (selected && attachments.length === 0) {
      /* const buttonWidth = 84
      const buttonHeight = 24
      const buttonX = x + (width - buttonWidth) / 2
      const buttonY = y + 3
      const buttonBox = { x: buttonX, y: buttonY, width: buttonWidth, height: buttonHeight }
      TODO: Show the tooltip when drag and drop is supported
      for now, the tooltip does not make sense */
      return
    }
    const rowHeight = pxToRowHeight[height] ?? 1

    const { getPossibleAttachmentSrc } = useAttachment()
    const horizontalPadding = 10
    const verticalPadding = rowHeight === 1 ? 4 : 8
    const itemSize = rowHeight === 1 ? 24 : rowHeight === 2 ? 32 : 64
    const gap = 8

    const itemsPerRow = Math.floor((width - horizontalPadding * 2 + gap) / (itemSize + gap))
    const totalItems = attachments.length
    const itemsInLastRow = totalItems % itemsPerRow || itemsPerRow

    const maxRows = Math.floor((height - verticalPadding * 2 + gap) / (itemSize + gap))
    const maxVisibleItems = maxRows * itemsPerRow

    const imageBoxes: (RenderRectangleProps & { title: string })[] = []

    attachments.slice(0, maxVisibleItems).forEach((item, index) => {
      if (!item) return

      const row = Math.floor(index / itemsPerRow)
      const col = index % itemsPerRow

      const isLastRow = row === Math.floor((index + 1) / itemsPerRow)
      const itemsInCurrentRow = isLastRow ? itemsInLastRow : itemsPerRow

      const currentRowWidth = itemsInCurrentRow * itemSize + (itemsInCurrentRow - 1) * gap
      const rowStartX = x + horizontalPadding + (width - horizontalPadding * 2 - currentRowWidth) / 2

      const itemX = rowStartX + col * (itemSize + gap)
      const itemY = y + verticalPadding + row * (itemSize + gap)

      if (isImage(item.title, item.mimetype || item.type)) {
        const size = getAttachmentSize(rowHeight)
        const url = getPossibleAttachmentSrc(item, size)?.[0]

        if (!url) {
          // broken_image
          return
        }

        const img = imageLoader.loadOrGetImage(url)
        if (img) {
          imageBoxes.push({
            x: itemX,
            y: itemY,
            width: itemSize,
            height: itemSize,
            title: item.title ?? url,
          })
        }
      } else if (item.title) {
        imageBoxes.push({
          x: itemX,
          y: itemY,
          width: itemSize,
          height: itemSize,
          title: item.title,
        })
      }
    })

    const hoveredPreview = imageBoxes.find((box) => isBoxHovered(box, mousePosition))
    if (tryShowTooltip({ rect: hoveredPreview, text: hoveredPreview?.title ?? '', mousePosition })) {
      return
    }

    if (!attachments.length) return

    const buttonY = y + 5
    const maximizeBox = {
      x: x + width - 30,
      y: buttonY,
      width: 18,
      height: 18,
    }

    const attachBox = {
      x: x + 11,
      y: buttonY,
      width: 18,
      height: 18,
    }

    tryShowTooltip({ rect: maximizeBox, text: getI18n().global.t('activity.viewAttachment'), mousePosition })
    tryShowTooltip({ rect: attachBox, text: getI18n().global.t('activity.addFiles'), mousePosition })
  },
  async handleKeyDown({ row, column, e, makeCellEditable }) {
    if (e.key === 'Enter') {
      makeCellEditable(row.rowMeta.rowIndex!, column)
      return true
    }
    return false
  },

  async handleClick({ row, column, mousePosition, getCellPosition, value, selected, imageLoader, makeCellEditable }) {
    const { hideTooltip } = useTooltipStore()
    hideTooltip()
    const enableEdit = () => makeCellEditable(row.rowMeta.rowIndex!, column)
    const { x, y, width, height } = getCellPosition(column, row.rowMeta.rowIndex!)

    let attachments: Attachment[] = []
    try {
      attachments = (typeof value === 'string' ? JSON.parse(value) : value) || []
    } catch {
      attachments = []
    }
    if (selected && attachments.length === 0) {
      const buttonWidth = 84
      const buttonHeight = 24
      const buttonX = x + (width - buttonWidth) / 2
      const buttonY = y + 3
      const buttonBox = { x: buttonX, y: buttonY, width: buttonWidth, height: buttonHeight }
      if (isBoxHovered(buttonBox, mousePosition)) {
        enableEdit()
        return true
      }
    }
    const rowHeight = pxToRowHeight[height] ?? 1

    const { getPossibleAttachmentSrc } = useAttachment()
    const horizontalPadding = 10
    const verticalPadding = rowHeight === 1 ? 4 : 8
    const itemSize = rowHeight === 1 ? 24 : rowHeight === 2 ? 32 : 64
    const gap = 8

    const itemsPerRow = Math.floor((width - horizontalPadding * 2 + gap) / (itemSize + gap))
    const totalItems = attachments.length
    const itemsInLastRow = totalItems % itemsPerRow || itemsPerRow

    const maxRows = Math.floor((height - verticalPadding * 2 + gap) / (itemSize + gap))
    const maxVisibleItems = maxRows * itemsPerRow

    const imageBoxes: (RenderRectangleProps & { title: string })[] = []

    attachments.slice(0, maxVisibleItems).forEach((item, index) => {
      if (!item) return

      const row = Math.floor(index / itemsPerRow)
      const col = index % itemsPerRow

      const isLastRow = row === Math.floor((index + 1) / itemsPerRow)
      const itemsInCurrentRow = isLastRow ? itemsInLastRow : itemsPerRow

      const currentRowWidth = itemsInCurrentRow * itemSize + (itemsInCurrentRow - 1) * gap
      const rowStartX = x + horizontalPadding + (width - horizontalPadding * 2 - currentRowWidth) / 2

      const itemX = rowStartX + col * (itemSize + gap)
      const itemY = y + verticalPadding + row * (itemSize + gap)

      if (isImage(item.title, item.mimetype || item.type)) {
        const size = getAttachmentSize(rowHeight)
        const url = getPossibleAttachmentSrc(item, size)?.[0]

        if (!url) {
          // broken_image
          return
        }

        const img = imageLoader.loadOrGetImage(url)
        if (img) {
          imageBoxes.push({
            x: itemX,
            y: itemY,
            width: itemSize,
            height: itemSize,
            title: item.title ?? url,
          })
        }
      } else if (item.title) {
        imageBoxes.push({
          x: itemX,
          y: itemY,
          width: itemSize,
          height: itemSize,
          title: item.title,
        })
      }
    })

    const hoveredPreview = imageBoxes.find((box) => isBoxHovered(box, mousePosition))
    if (hoveredPreview) {
      enableEdit()
      return true
    }
    if (!attachments.length) return false

    const buttonY = y + 5
    const maximizeBox = {
      x: x + width - 30,
      y: buttonY,
      width: 18,
      height: 18,
    }

    const attachBox = {
      x: x + 11,
      y: buttonY,
      width: 18,
      height: 18,
    }

    if (isBoxHovered(maximizeBox, mousePosition) || isBoxHovered(attachBox, mousePosition)) {
      enableEdit()
      return true
    }
    return false
  },
}
