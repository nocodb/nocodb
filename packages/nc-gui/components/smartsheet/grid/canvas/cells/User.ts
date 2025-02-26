import { IconType } from 'nocodb-sdk'
import { defaultOffscreen2DContext, isBoxHovered, renderSingleLineText, renderTag, roundedRect } from '../utils/canvas'
import type { RenderRectangleProps } from '../utils/types'
import { getSelectedUsers } from '../../../../cell/User/utils'

const tagPadding = 8
const tagSpacingY = 4
const tagSpacingX = 8
const tagHeight = 20
const iconSize = 14
const ellipsisWidth = 15

const getUserIcon = (userMeta?: any) => {
  const { getPossibleAttachmentSrc } = useAttachment()

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

const usernameInitials = (username: string, email: string) => {
  const displayNameSplit = username.split(' ').filter((name) => name) ?? []

  if (displayNameSplit.length > 0) {
    if (displayNameSplit.length > 1) {
      return (displayNameSplit[0]?.[0] ?? '') + (displayNameSplit[1]?.[0] ?? '')
    } else {
      return username.slice(0, 2)
    }
  } else {
    return email.split('@')?.[0]?.slice(0, 2) ?? ''
  }
}

const backgroundColor = (username: string, email: string, userIcon: ReturnType<typeof getUserIcon>) => {
  const color = username ? stringToColor(username) : email ? stringToColor(email) : '#FFFFFF'
  const bgColor = '#F4F4F5'

  if (userIcon.icon) {
    switch (userIcon.iconType) {
      case IconType.IMAGE:
        return ''
      case IconType.EMOJI:
      case IconType.ICON:
        return bgColor
      default:
        return color || '#FFFFFF'
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
    const users = getSelectedUsers(column?.extra?.optionsMap || {}, value)

    if (!users.length) return

    let count = 0
    let line = 1
    for (const user of users) {
      const userDisplayName = user.display_name?.trim() ?? ''
      const userEmail = user.email ?? ''
      const displayName = userDisplayName || userEmail

      const isDeleted = user.deleted

      const { text: truncatedText, width: textWidth } = renderSingleLineText(ctx, {
        text: displayName,
        maxWidth: width - tagPadding * 2 - iconSize - 8,
        render: false,
      })
      const minTagWidth = iconSize + 8 + textWidth + tagPadding * 2

      if (x + minTagWidth > _x + _width - padding * 2) {
        if (y + tagHeight * 2 + tagSpacingY > _y + height || line >= rowHeightTruncateLines(height, true)) {
          renderSingleLineText(ctx, {
            x: x + padding + tagSpacingX,
            y,
            text: '...',
            maxWidth: ellipsisWidth,
            textAlign: 'right',
            verticalAlign: 'middle',
            fontFamily: '500 13px Manrope',
            fillStyle: isDeleted ? '#4a5268' : '#0b1d05',
            height,
          })
          x = x + padding + tagSpacingX + ellipsisWidth
          y = y + tagHeight + tagSpacingY
          break
        }

        // Wrap to the next line
        x = _x + padding // Reset x to start of the row
        y += tagHeight + tagSpacingY // Move to the next line
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

      const userIcon = getUserIcon(user.meta)
      const isImage = userIcon.icon && userIcon.iconType === IconType.IMAGE && !!userIcon.icon[0]
      const initials = usernameInitials(userDisplayName, userEmail)
      const circleSize = 19
      const circleRadius = circleSize / 2
      const enableBackground = isDeleted ? true : !isImage
      const bgColor = isImage ? 'transparent' : backgroundColor(userDisplayName, userEmail, userIcon)
      const textColor = isColorDark(bgColor) ? 'white' : 'black'

      const url = isImage ? (userIcon.icon as string[])?.[0] ?? '' : ''
      const icon = userIcon.icon as string

      if (enableBackground) {
        roundedRect(ctx, x, y + 6.5, circleSize, circleSize, circleRadius, {
          backgroundColor: isDeleted ? '#BBBBBB' : bgColor,
        })
      }

      let needsPlaceholder = true
      if (isImage) {
        const img = imageLoader.loadOrGetImage(url)
        if (img) {
          imageLoader.renderImage(ctx, img, x, y + 6, circleSize, circleSize, circleRadius, { border: false })
          needsPlaceholder = false
        }
      } else if (userIcon.icon && userIcon.iconType === IconType.EMOJI) {
        if (isUnicodeEmoji(icon)) {
          renderSingleLineText(ctx, { x: x + 3.5, y: y + 1, text: icon })
          needsPlaceholder = false
        } else {
          // TODO:
          needsPlaceholder = true
        }
      } else if (userIcon.icon && userIcon.iconType === IconType.ICON) {
        spriteLoader.renderIcon(ctx, {
          color: 'black',
          icon: icon as IconMapKey,
          size: 12,
          x: x + 4,
          y: y + 9.5,
        })
        needsPlaceholder = false
      } else if (isDeleted) {
        needsPlaceholder = false
      } else if (initials) {
        renderSingleLineText(ctx, {
          x: x + circleRadius,
          y,
          text: initials.toLocaleUpperCase(),
          fontFamily: '600 10px Manrope',
          textAlign: 'center',
          verticalAlign: 'middle',
          fillStyle: textColor,
        })
        needsPlaceholder = false
      }

      if (needsPlaceholder) {
        spriteLoader.renderIcon(ctx, {
          icon: 'user',
          size: iconSize,
          x: x + 2.5,
          y: y + 6 + (tagHeight - iconSize) / 2,
          color: textColor,
        })
      }

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

      x = x + minTagWidth + tagSpacingX
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
    const { hideTooltip, tryShowTooltip } = useTooltipStore()
    hideTooltip()

    const { x: _x, y: _y, width: _width, height } = getCellPosition(column, row.rowMeta.rowIndex!)
    const padding = 10
    let x = _x + padding
    let y = _y
    let width = _width - padding * 2

    width = width - padding * 2
    const meta = parseProp(column?.columnObj.meta)
    const isMultiple = meta?.is_multi ?? false
    const users = getSelectedUsers(column?.extra?.optionsMap || {}, value)

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

      if (x + minTagWidth > _x + _width - padding * 2) {
        if (y + tagHeight * 2 + tagSpacingY > _y + height || line >= rowHeightTruncateLines(height, true)) {
          break
        }

        x = _x + padding
        y += tagHeight + tagSpacingY
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

      x = x + minTagWidth + tagSpacingX

      if (!isMultiple) break
    }

    if (!boxes.length) return

    const hoveredBox = boxes.find((box) => isBoxHovered(box, mousePosition))
    if (!hoveredBox) return
    tryShowTooltip({ text: hoveredBox.text, rect: hoveredBox, mousePosition })
  },

  async handleClick({ row, column, mousePosition, getCellPosition, makeCellEditable }) {
    if (column.readonly || !column?.isCellEditable) return false

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

    makeCellEditable(row, column)
    return true
  },

  async handleKeyDown({ e, row, column, makeCellEditable }) {
    if (column.readonly || !column?.isCellEditable) return false
    if (e.key.length === 1) {
      makeCellEditable(row, column)
      return true
    }
    return false
  },
}
