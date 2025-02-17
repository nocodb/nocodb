import { truncateText } from '../utils/canvas'

export const CurrencyRenderer: CellRenderer = {
  render: (ctx, { value, x, y, width, height, selected, pv, column }) => {
    const padding = 10
    ctx.font = `${pv ? 600 : 500} 13px Manrope`
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'

    if (value === null || value === undefined || isNaN(value)) return

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

    const maxWidth = width - padding * 2
    const truncatedText = truncateText(ctx, formattedValue, maxWidth)
    const textY = y + height / 2

    ctx.fillStyle = selected || pv ? '#4351e8' : '#4a5268'
    ctx.fillText(truncatedText, x + padding, textY)
  },
}
