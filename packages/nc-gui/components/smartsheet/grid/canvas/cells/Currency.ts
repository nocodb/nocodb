import { renderSingleLineText, renderTag } from '../utils/canvas'

export const CurrencyRenderer: CellRenderer = {
  render: (ctx, props) => {
    const { column, selected, value, x, y, width, height, pv, padding, textColor = '#4a5268' } = props
    const {
      renderAsTag,
      tagPaddingX = 8,
      tagHeight = 20,
      tagRadius = 6,
      tagBgColor = '#f4f4f0',
      tagBorderColor,
      tagBorderWidth,
    } = props.tag || {}

    if (!isValidValue(value) || isNaN(value)) {
      return {
        x,
        y,
      }
    }

    const currencyMeta = {
      currency_locale: 'en-US',
      currency_code: 'USD',
      ...(parseProp(column?.meta) || {}),
    }

    let formattedValue = ''
    try {
      formattedValue = new Intl.NumberFormat(currencyMeta.currency_locale || 'en-US', {
        style: 'currency',
        currency: currencyMeta.currency_code || 'USD',
      }).format(value)
    } catch (e) {
      formattedValue = value.toString()
    }

    if (!value) {
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
        text: formattedValue,
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
        text: formattedValue,
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
