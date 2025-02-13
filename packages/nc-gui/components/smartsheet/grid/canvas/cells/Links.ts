import { renderSingleLineText } from '../utils/canvas'

export const LinksCellRenderer: CellRenderer = {
  render: (ctx, { column, value, x, y, width, height, padding, t }) => {
    const parsedValue = +value || 0

    let text = ''
    if (!parsedValue) {
      text = t('msg.noRecordsLinked')
    } else if (parsedValue === 1) {
      text = `1 ${column?.meta?.singular || t('general.link')}`
    } else {
      text = `${parsedValue} ${column?.meta?.plural || t('general.links')}`
    }

    // If it is empty text then no need to render
    if (!text) return

    renderSingleLineText(ctx, {
      x: x + padding,
      y: y,
      text,
      maxWidth: width - padding * 2,
      fontFamily: '500 13px Manrope',
      fillStyle: '#4351e8',
      height,
    })
  },
}
