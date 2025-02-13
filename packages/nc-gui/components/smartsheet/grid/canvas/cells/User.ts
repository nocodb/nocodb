import type { UserType } from 'nocodb-sdk'
import { isBoxHovered, renderSingleLineText, renderTag } from '../utils/canvas'
import type { RenderRectangleProps } from '../utils/types'

const tagPadding = 8
const tagSpacing = 4
const tagHeight = 20
const iconSize = 14
const ellipsisWidth = 15

const offscreenCanvas = new OffscreenCanvas(0, 0)
const defaultContext = offscreenCanvas.getContext('2d')!

export const UserFieldCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const { value, x: _x, y: _y, width: _width, height, column, spriteLoader, padding } = props
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

      spriteLoader.renderIcon(ctx, {
        icon: 'user',
        size: iconSize,
        x: x + tagPadding,
        y: y + 6 + (tagHeight - iconSize) / 2,
        color: '#0b1d05',
      })

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

      if (!isMultiple) break
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
    const ctx = defaultContext

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
}
