import { type ColumnType, FormulaDataTypes, handleTZ } from 'nocodb-sdk'
import { defaultOffscreen2DContext, isBoxHovered, renderFormulaURL, renderSingleLineText } from '../utils/canvas'
import { showFieldEditWarning } from '../utils/cell'
import { CheckboxCellRenderer } from './Checkbox'
import { CurrencyRenderer } from './Currency'
import { DateCellRenderer } from './Date'
import { DateTimeCellRenderer } from './DateTime'
import { DecimalCellRenderer } from './Decimal'
import { EmailCellRenderer } from './Email'
import { PercentCellRenderer } from './Percent'
import { PhoneNumberCellRenderer } from './PhoneNumber'
import { RatingCellRenderer } from './Rating'
import { SingleLineTextCellRenderer } from './SingleLineText'
import { TimeCellRenderer } from './Time'
import { UrlCellRenderer } from './Url'
import { FloatCellRenderer } from './Number'

function getDisplayValueCellRenderer(column: ColumnType) {
  const colMeta = parseProp(column.meta)
  const modifiedColumn = {
    uidt: colMeta?.display_type,
    ...colMeta?.display_column_meta,
  }
  if (isBoolean(modifiedColumn)) return CheckboxCellRenderer
  else if (isCurrency(modifiedColumn)) return CurrencyRenderer
  else if (isDecimal(modifiedColumn)) return DecimalCellRenderer
  else if (isPercent(modifiedColumn)) return PercentCellRenderer
  else if (isRating(modifiedColumn)) return RatingCellRenderer
  else if (isDate(modifiedColumn, '')) return DateCellRenderer
  else if (isDateTime(modifiedColumn, '')) return DateTimeCellRenderer
  else if (isTime(modifiedColumn, '')) return TimeCellRenderer
  else if (isEmail(modifiedColumn)) return EmailCellRenderer
  else if (isURL(modifiedColumn)) return UrlCellRenderer
  else if (isPhoneNumber(modifiedColumn)) return PhoneNumberCellRenderer
  else return SingleLineTextCellRenderer
}

export const FormulaCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const { column, x, y, padding, isPg, value, width, pv, height, textColor = '#4a5268', mousePosition, setCursor } = props
    const colMeta = parseProp(column.meta)
    if (parseProp(column.colOptions)?.error) {
      renderSingleLineText(ctx, {
        text: 'ERR!',
        x: x + padding,
        y,
      })
      return
    }

    if (colMeta?.display_type) {
      getDisplayValueCellRenderer(column).render(ctx, {
        ...props,
        column: {
          ...column,
          uidt: colMeta?.display_type,
          ...colMeta.display_column_meta,
        },
        readonly: true,
        formula: true,
      })
    } else {
      const result = isPg(column.source_id) ? renderValue(handleTZ(value)) : renderValue(value)

      if (column?.colOptions?.parsed_tree?.dataType === FormulaDataTypes.NUMERIC) {
        FloatCellRenderer.render(ctx, {
          ...props,
          value: result,
          formula: true,
        })
        return
      }

      const urls = replaceUrlsWithLink(result)
      const maxWidth = width - padding * 2
      if (typeof urls === 'string') {
        const texts = getFormulaTextSegments(urls)
        ctx.font = `${pv ? 600 : 500} 13px Manrope`
        ctx.fillStyle = pv ? '#3366FF' : textColor
        const boxes = renderFormulaURL(ctx, {
          texts,
          height,
          maxWidth,
          x: x + padding,
          y: y + 3,
          lineHeight: 16,
          underlineOffset: y < 36 ? 0 : 3,
        })
        const hoveredBox = boxes.find((box) => isBoxHovered(box, mousePosition))
        if (hoveredBox) {
          setCursor('pointer')
        }
        return
      }

      SingleLineTextCellRenderer.render(ctx, {
        ...props,
        value: result,
        formula: true,
      })
    }
  },
  handleClick: async (props) => {
    const { x, y, width, height } = props.getCellPosition(props.column, props.row.rowMeta.rowIndex!)
    const baseStore = useBase()
    const { isPg } = baseStore
    const result = isPg(props.column.columnObj.source_id) ? renderValue(handleTZ(props.value)) : renderValue(props.value)
    const urls = replaceUrlsWithLink(result)
    const padding = 10
    const maxWidth = width - padding * 2
    const pv = props.column.pv
    const textColor = '#4a5268'
    if (typeof urls === 'string') {
      const texts = getFormulaTextSegments(urls)
      const ctx = defaultOffscreen2DContext
      ctx.font = `${pv ? 600 : 500} 13px Manrope`
      ctx.fillStyle = pv ? '#3366FF' : textColor
      const boxes = renderFormulaURL(ctx, {
        texts,
        height,
        maxWidth,
        x: x + padding,
        y: y + 3,
        lineHeight: 16,
        underlineOffset: y < 36 ? 0 : 3,
      })
      const hoveredBox = boxes.find((box) => isBoxHovered(box, props.mousePosition))
      if (hoveredBox) {
        window.open(hoveredBox.url, '_blank')
      }
      return true
    }
    // Todo: show inline warning
    if (props.event?.detail === 2) {
      showFieldEditWarning()
      return true
    }

    return false
  },
  handleKeyDown: async (props) => {
    // Todo: show inline warning
    if (props.e.key === 'Enter') {
      showFieldEditWarning()
      return true
    }
  },
  async handleHover(props) {
    const { mousePosition, getCellPosition, column, row } = props
    const colObj = column.columnObj
    const colMeta = parseProp(colObj.meta)
    const error = parseProp(colObj.colOptions)?.error ?? ''
    const { tryShowTooltip, hideTooltip } = useTooltipStore()
    hideTooltip()
    if (colMeta?.display_type || !error) {
      return getDisplayValueCellRenderer(colObj)?.handleHover?.({
        ...props,
        column: {
          ...column,
          columnObj: {
            ...colObj,
            uidt: colMeta?.display_type,
            ...colMeta.display_column_meta,
          },
        },
      })
    }
    const { x, y } = getCellPosition(column, row.rowMeta.rowIndex!)

    tryShowTooltip({ rect: { x: x + 10, y, height: 25, width: 45 }, mousePosition, text: error })
  },
}
