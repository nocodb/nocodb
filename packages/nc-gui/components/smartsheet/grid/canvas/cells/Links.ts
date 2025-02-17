import { renderSingleLineText, renderTag } from '../utils/canvas'

export const LinksCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const { column, value, x, y, width, height, pv, padding, textColor = '#4a5268', t, spriteLoader, mousePosition } = props
    const {
      renderAsTag,
      tagPaddingX = 8,
      tagHeight = 20,
      tagRadius = 6,
      tagBgColor = '#f4f4f0',
      tagBorderColor,
      tagBorderWidth,
    } = props.tag || {}

    const parsedValue = +value || 0

    let text = ''
    if (!parsedValue) {
      text = t('msg.noRecordsLinked')
    } else if (parsedValue === 1) {
      text = `1 ${column?.meta?.singular || t('general.link')}`
    } else {
      text = `${parsedValue} ${column?.meta?.plural || t('general.links')}`
    }

    if (renderAsTag) {
      const maxWidth = width - padding * 2 - tagPaddingX * 2

      const { text: truncatedText, width: textWidth } = renderSingleLineText(ctx, {
        x: x + padding + tagPaddingX,
        y: y + padding,
        text,
        maxWidth,
        fontFamily: `${pv ? 600 : 500} 13px Manrope`,
        render: false,
      })

      renderTag(ctx, {
        x: x + padding,
        y: y + padding - 4,
        width: textWidth + tagPaddingX * 2,
        height: tagHeight,
        radius: tagRadius,
        fillStyle: tagBgColor,
        borderColor: tagBorderColor,
        borderWidth: tagBorderWidth,
      })

      renderSingleLineText(ctx, {
        x: x + padding + tagPaddingX,
        y,
        text: truncatedText,
        maxWidth,
        fontFamily: `${pv ? 600 : 500} 13px Manrope`,
        fillStyle: textColor,
      })

      return {
        x: x + padding + textWidth + tagPaddingX * 2,
        y: y + padding - 4 + tagHeight,
      }
    } else {
      const { x: xOffset, y: yOffset } = renderSingleLineText(ctx, {
        x: x + padding,
        y,
        text,
        maxWidth: width - padding * 2,
        fontFamily: '500 13px Manrope',
        fillStyle: '#4351e8',
        height,
      })

      if (mousePosition.x >= x && mousePosition.x <= x + width && mousePosition.y >= y && mousePosition.y <= y + height) {
        spriteLoader.renderIcon(ctx, {
          icon: 'ncPlus',
          x: x + width - 16 - padding,
          y: y + 7,
          size: 16,
          color: '#374151',
        })
      }

      return {
        x: xOffset,
        y: yOffset,
      }
    }
  },
  handleClick({ event, mousePosition, value, column, row, getCellPosition, updateOrSaveRow }) {
    console.log(mousePosition)
  },
}
