import type { UserType } from 'nocodb-sdk'

export const UserFieldCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const { value, x, y, width, height, column, spriteLoader } = props
    const padding = 6
    const tagSpacing = 4
    const tagHeight = 20
    const iconSize = 14
    const ellipsisWidth = 15

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
    const maxRows = Math.floor((height - padding) / (tagHeight + tagSpacing))
    if (maxRows < 1) return

    ctx.font = '500 13px Manrope'
    const firstUser = users[0]
    if (!firstUser) return
    const displayName = firstUser.display_name?.trim() || firstUser.email!
    const textWidth = ctx.measureText(displayName).width
    const minTagWidth = iconSize + 8 + textWidth + padding

    if (minTagWidth > width - padding * 2) {
      ctx.fillStyle = '#666'
      ctx.textBaseline = 'middle'
      ctx.fillText('...', x + padding, y + height / 2)
      return
    }

    let currentX = x + padding
    let currentY = y + padding
    let currentRow = 0
    let drawnUsers = 0

    for (const user of users) {
      const displayName = user.display_name?.trim() || user.email!
      const textWidth = ctx.measureText(displayName).width
      const tagWidth = iconSize + 8 + textWidth + padding

      const needsNewRow = currentX + tagWidth > x + width - (drawnUsers < users.length - 1 ? ellipsisWidth + padding : 0)

      if (needsNewRow) {
        // If we'll exceed max rows, show ellipsis on current line and break
        if (currentRow + 1 >= maxRows) {
          if (drawnUsers < users.length) {
            ctx.fillStyle = '#0b1d05'
            ctx.fillText('...', currentX + tagSpacing, currentY + tagHeight / 2)
          }
          break
        }

        // Otherwise move to next row
        currentRow++
        currentX = x + padding
        currentY += tagHeight + tagSpacing
      }

      ctx.fillStyle = '#e7e7e9'
      ctx.beginPath()
      ctx.roundRect(currentX, currentY, tagWidth, tagHeight, 12)
      ctx.fill()

      spriteLoader.renderIcon(ctx, {
        icon: 'user',
        size: iconSize,
        x: currentX + 4,
        y: currentY + (tagHeight - iconSize) / 2,
        color: '#0b1d05',
      })

      ctx.fillStyle = '#0b1d05'
      ctx.textBaseline = 'middle'
      ctx.fillText(displayName, currentX + iconSize + 8, currentY + tagHeight / 2)

      currentX += tagWidth + tagSpacing
      drawnUsers++

      if (!isMultiple) break

      // Check if we need to show ellipsis on the current line
      if (drawnUsers < users.length && currentX + ellipsisWidth > x + width - padding) {
        ctx.fillStyle = '#666'
        ctx.fillText('...', currentX, currentY + tagHeight / 2)
        break
      }
    }
  },
}
