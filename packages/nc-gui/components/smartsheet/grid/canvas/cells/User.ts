import { IconType, type UserType } from 'nocodb-sdk'
import { defaultOffscreen2DContext, isBoxHovered, renderSingleLineText, renderTag, roundedRect } from '../utils/canvas'
import type { RenderRectangleProps } from '../utils/types'

const tagPadding = 8
const tagSpacing = 4
const tagHeight = 20
const iconSize = 14
const ellipsisWidth = 15

const getUserIcon = (userMeta?: any) => {
  if (!userMeta) {
    return {
      icon: '',
      iconType: '',
    }
  }

  const icon = parseProp(userMeta).icon || ''
  const iconType = parseProp(userMeta).iconType || ''

  return {
    icon: iconType === IconType.IMAGE && ncIsObject(icon) ? getPossibleAttachmentSrc(icon) || '' : (icon as string),
    iconType,
  }
}

const usernameInitials = (displayName: string, email: string) => {
  const displayNameSplit = displayName?.split(' ').filter((name) => name) ?? []

  if (displayNameSplit.length > 0) {
    if (displayNameSplit.length > 1) {
      return displayNameSplit?.[0]?.[0] ?? `${displayNameSplit?.[1]?.[0]}` ?? ''
    } else {
      return displayName.slice(0, 2)
    }
  } else {
    return email?.split('@')?.[0]?.slice(0, 2) ?? ''
  }
}

const backgroundColor = (displayName: string, email: string, userIcon: ReturnType<typeof getUserIcon>) => {
  // in comments we need to generate user icon from email
  const color = displayName ? stringToColor(displayName) : email ? stringToColor(email) : '#FFFFFF'
  const bgColor = '#F4F4F5'
  if (userIcon.icon) {
    switch (userIcon.iconType) {
      case IconType.IMAGE: {
        return ''
      }
      case IconType.EMOJI: {
        return bgColor
      }
      case IconType.ICON: {
        return bgColor
      }

      default: {
        return color || '#FFFFFF'
      }
    }
  }

  return color || '#FFFFFF'
}

export const UserFieldCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const { value, x: _x, y: _y, width: _width, height, column, spriteLoader, padding, imageLoader } = props
    let x = _x + padding
    let y = _y
    let width = _width - padding * 2

    width = width - padding * 2

    const meta = parseProp(column?.meta)
    const isMultiple = meta?.is_multi ?? false

    let users: Partial<UserType>[] = []
    try {
      if (typeof value === 'string') {
        if (value.startsWith('[') || value.startsWith('{')) {
          users = JSON.parse(value)
        } else {
          users = value.split(',').map((id) => ({ id: id.trim(), email: id.trim() }))
        }
      } else if (Array.isArray(value)) {
        users = value
      } else if (value) {
        users = [value]
      }
      users = users.filter((u) => u && (u.id || u.email))
    } catch {
      users = []
    }

    if (!users.length) return

    let count = 0
    let line = 1
    for (const user of users) {
      const displayName = user.display_name?.trim() || user.email!

      const { text: truncatedText, width: textWidth } = renderSingleLineText(ctx, {
        text: displayName,
        maxWidth: width - tagPadding * 2 - iconSize - 8,
        render: false,
      })
      const minTagWidth = iconSize + 8 + textWidth + tagPadding * 2

      // Check if the tag fits in the current row
      if (x + minTagWidth > _x + _width - padding * 2) {
        // Check if there is space for `...` on the same line

        if (y + tagHeight * 2 + tagSpacing > _y + height || line >= rowHeightTruncateLines(height, true)) {
          // Not enough space for `...` on the current line, so stop rendering
          renderSingleLineText(ctx, {
            x: x + padding + tagSpacing, // Align `...` at the end
            y,
            text: '...',
            maxWidth: ellipsisWidth,
            textAlign: 'right',
            verticalAlign: 'middle',
            fontFamily: '500 13px Manrope',
            fillStyle: '#0b1d05',
            height,
          })
          x = x + padding + tagSpacing + ellipsisWidth
          y = y + tagHeight + tagSpacing
          break
        }

        // Wrap to the next line
        x = _x + padding // Reset x to start of the row
        y += tagHeight + tagSpacing // Move to the next line
        line += 1
      }

      renderTag(ctx, {
        x,
        y: y + 6,
        width: minTagWidth,
        height: tagHeight,
        radius: 12,
        fillStyle: '#e7e7e9',
      })

      // icon/image/emoji rendering
      const userIcon = getUserIcon(user.meta)

      const isImage = userIcon.icon && userIcon.iconType === IconType.IMAGE && !!userIcon.icon[0]
      const circleSize = 17
      const circleRadius = circleSize / 2
      const enableBackground = false
      if (enableBackground) {
        roundedRect(ctx, x, y + 8, circleSize, circleSize, circleRadius, {
          backgroundColor: isImage ? 'transparent' : backgroundColor(displayName, user.email ?? '', userIcon),
        })
      }
      let needsPlaceholder = true
      if (isImage) {
        const img = imageLoader.loadOrGetImage(userIcon.icon[0])
        if (img) {
          imageLoader.renderImage(ctx, img, x, y + 6, circleSize, circleSize, circleRadius, { border: false })
          needsPlaceholder = false
        }
      } else if (userIcon.icon && userIcon.iconType === IconType.EMOJI) {
        // render emoji
        needsPlaceholder = false
      }

      if (needsPlaceholder) {
        spriteLoader.renderIcon(ctx, {
          icon: 'user',
          size: iconSize,
          x: x + tagPadding,
          y: y + 6 + (tagHeight - iconSize) / 2,
          color: '#0b1d05',
        })
      }
      // end

      renderSingleLineText(ctx, {
        x: x + tagPadding + iconSize + 4,
        y,
        text: truncatedText,
        maxWidth: width - tagPadding * 2,
        textAlign: 'left',
        verticalAlign: 'middle',
        fontFamily: '500 13px Manrope',
        fillStyle: '#0b1d05',
        height,
      })

      x = x + minTagWidth + tagSpacing
      count++

      if (!isMultiple) break
    }
    return {
      x,
      y,
      nextLine: count < users.length,
    }
  },

  async handleHover({ column, getCellPosition, row, mousePosition, value }) {
    const { showTooltip, hideTooltip } = useTooltipStore()
    hideTooltip()

    const { x: _x, y: _y, width: _width, height } = getCellPosition(column, row.rowMeta.rowIndex!)
    const padding = 10
    let x = _x + padding
    let y = _y
    let width = _width - padding * 2

    width = width - padding * 2
    const meta = parseProp(column?.columnObj.meta)
    const isMultiple = meta?.is_multi ?? false

    let users: Partial<UserType>[] = []
    try {
      if (typeof value === 'string') {
        if (value.startsWith('[') || value.startsWith('{')) {
          users = JSON.parse(value)
        } else {
          users = value.split(',').map((id) => ({ id: id.trim(), email: id.trim() }))
        }
      } else if (Array.isArray(value)) {
        users = value
      } else if (value) {
        users = [value]
      }
      users = users.filter((u) => u && (u.id || u.email))
    } catch {
      users = []
    }

    if (!users.length) return
    const boxes: (RenderRectangleProps & { text: string })[] = []
    const ctx = defaultOffscreen2DContext

    let line = 1
    for (const user of users) {
      const displayName = user.display_name?.trim() || user.email!

      const { text: truncatedText, width: textWidth } = renderSingleLineText(ctx, {
        text: displayName,
        maxWidth: width - tagPadding * 2 - iconSize - 8,
        render: false,
      })
      const minTagWidth = iconSize + 8 + textWidth + tagPadding * 2

      // Check if the tag fits in the current row
      if (x + minTagWidth > _x + _width - padding * 2) {
        // Check if there is space for `...` on the same line

        if (y + tagHeight * 2 + tagSpacing > _y + height || line >= rowHeightTruncateLines(height, true)) {
          // Not enough space for `...` on the current line, so stop rendering
          break
        }

        // Wrap to the next line
        x = _x + padding // Reset x to start of the row
        y += tagHeight + tagSpacing // Move to the next line
        line += 1
      }
      if (displayName !== truncatedText) {
        boxes.push({
          x,
          y: y + 6,
          width: minTagWidth,
          height: tagHeight,
          text: displayName,
        })
      }

      x = x + minTagWidth + tagSpacing

      if (!isMultiple) break
    }

    if (!boxes.length) return

    const hoveredBox = boxes.find((box) => isBoxHovered(box, mousePosition))
    if (!hoveredBox) return
    showTooltip({
      position: {
        x: hoveredBox.x + hoveredBox.width / 2,
        y: hoveredBox.y + 20,
      },
      text: hoveredBox.text,
    })
  },
  async handleClick({ row, column, mousePosition, getCellPosition, makeCellEditable }) {
    const { x, y, width } = getCellPosition(column, row.rowMeta.rowIndex!)

    const padding = 10

    const _x = x + padding
    const _y = y

    const _width = width - padding * 2

    const isSelectedTags = isBoxHovered(
      {
        x: _x,
        y: _y,
        width: _width,
        height: 20,
      },
      mousePosition,
    )

    if (!isSelectedTags) return false

    makeCellEditable(row.rowMeta?.rowIndex, column)
    return true
  },
}
