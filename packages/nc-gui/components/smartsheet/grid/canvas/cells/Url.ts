import { getI18n } from '../../../../../plugins/a.i18n'
import { defaultOffscreen2DContext, isBoxHovered, renderMultiLineText, renderTagLabel } from '../utils/canvas'

export const UrlCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const { value, x, y, column, width, height, selected, pv, padding, textColor = '#4a5268', spriteLoader, setCursor } = props

    const text = value?.toString() ?? ''

    if (!text) {
      return {
        x,
        y,
      }
    }

    const isValid = text && isValidURL(text)

    if (props.tag?.renderAsTag) {
      return renderTagLabel(ctx, { ...props, text })
    } else {
      const iconSize = 16

      const validate = parseProp(column?.meta).validate

      const maxWidth = width - padding * 2 - (validate && !isValid ? iconSize + 4 : 0)

      const { x: xOffset, y: yOffset } = renderMultiLineText(ctx, {
        x: x + padding,
        y,
        text,
        maxWidth,
        fontFamily: `${pv ? 600 : 500} 13px Manrope`,
        fillStyle: (isValid && selected) || pv ? '#3366FF' : textColor,
        underline: isValid,
        height,
      })

      const isHover = isBoxHovered(
        { x: x + padding, y: y + padding, width: xOffset - x - padding, height: yOffset - y },
        props.mousePosition,
      )
      if (isHover && isValid) {
        setCursor('pointer')
      }

      if (validate && !isValid) {
        const iconX = x + width - iconSize - padding

        spriteLoader.renderIcon(ctx, {
          icon: 'ncInfo',
          size: iconSize,
          color: themeV3Colors.red['400'],
          x: iconX,
          y: y + (yOffset - y) / 2,
        })
      }

      return {
        x: xOffset ? xOffset + (validate && !isValid ? iconSize + 4 : 0) : xOffset,
        y: yOffset,
      }
    }
  },
  async handleHover({ column, row, getCellPosition, value, mousePosition }) {
    const { x, y, width, height } = getCellPosition(column, row.rowMeta.rowIndex!)

    const { tryShowTooltip, hideTooltip } = useTooltipStore()
    hideTooltip()

    const text = value?.toString().trim() ?? ''

    const isValid = text && isValidURL(text)
    if (isValid) return

    const pv = column.pv
    const ctx = defaultOffscreen2DContext

    const iconSize = 16
    const padding = 10
    const iconX = x + width - iconSize - padding

    const { y: yOffset } = renderMultiLineText(ctx, {
      x: x + padding,
      y,
      text,
      maxWidth: width - padding * 2,
      fontFamily: `${pv ? 600 : 500} 13px Manrope`,
      height,
      render: false,
    })
    const validate = parseProp(column.columnObj.meta).validate

    if (validate) {
      const box = { x: iconX, y: y + (yOffset - y) / 2, width: iconSize, height: iconSize }

      tryShowTooltip({
        rect: box,
        text: getI18n().global.t('msg.error.invalidURL'),
        mousePosition,
      })
    }
  },
  async handleKeyDown(ctx) {
    const { e, row, column, makeCellEditable } = ctx
    if (column.readonly) return
    const columnObj = column.columnObj
    if (e.key.length === 1 && columnObj.title) {
      row.row[columnObj.title] = ''
      makeCellEditable(row, column)
      return true
    }

    return false
  },
  async handleClick({ value, row, column, getCellPosition, mousePosition }) {
    const { x, y, width, height } = getCellPosition(column, row.rowMeta.rowIndex!)
    const padding = 10

    const text = value?.toString().trim() ?? ''

    const isValid = text && isValidURL(text)
    if (!isValid) return false

    const pv = column.pv
    const ctx = defaultOffscreen2DContext

    const { x: xOffset, y: yOffset } = renderMultiLineText(ctx, {
      x: x + padding,
      y: y + padding,
      text,
      maxWidth: width - padding * 2,
      fontFamily: `${pv ? 600 : 500} 13px Manrope`,
      height,
      render: false,
    })

    if (isBoxHovered({ x, y, width: xOffset - x, height: yOffset - y }, mousePosition)) {
      window.open(/^https?:\/\//.test(text) ? text : `https://${text}`, '_blank')
      return true
    }
    return false
  },
}
