import dayjs from 'dayjs'
import { renderSingleLineText, renderTag } from '../utils/canvas'

export const DateCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const { column, value, x, y, width, height, pv, padding, textColor = '#4a5268', selected } = props
    const {
      renderAsTag,
      tagPaddingX = 8,
      tagHeight = 20,
      tagRadius = 6,
      tagBgColor = '#f4f4f0',
      tagBorderColor,
      tagBorderWidth,
    } = props.tag || {}

    const dateFormat = parseProp(column?.meta)?.date_format ?? 'YYYY-MM-DD'
    let formattedDate = ''

    if (value) {
      const date = dayjs(/^\d+$/.test(value) ? +value : value, dateFormat)
      if (date.isValid()) {
        formattedDate = date.format(dateFormat)
      }
    }

    if (!formattedDate) {
      return {
        x,
        y,
      }
    }

    if (renderAsTag) {
      const maxWidth = width - padding * 2 - tagPaddingX * 2

      const { text: truncatedText, width: textWidth } = renderSingleLineText(ctx, {
        x: x + padding + tagPaddingX,
        y: y + padding,
        text: formattedDate,
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
        y: y,
        text: truncatedText,
        maxWidth: maxWidth,
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
        text: formattedDate,
        maxWidth: width - padding * 2,
        fontFamily: `${pv ? 600 : 500} 13px Manrope`,
        fillStyle: selected || pv ? '#4351e8' : textColor,
        height,
      })

      return {
        x: xOffset,
        y: yOffset,
      }
    }
  },
}
