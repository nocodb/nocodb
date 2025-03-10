import { type ColumnType, FormulaDataTypes, UITypes, handleTZ } from 'nocodb-sdk'
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
import { LongTextCellRenderer } from './LongText'

function getDisplayValueCellRenderer(column: ColumnType, showAsLongText: boolean = false) {
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
  else if (showAsLongText) return LongTextCellRenderer
  else return SingleLineTextCellRenderer
}

function shouldShowAsLongText({ column, width, value }: { column: ColumnType; width: number; value: any }) {
  defaultOffscreen2DContext.font = '500 13px Manrope'

  return (
    (!column.colOptions?.parsed_tree?.dataType || column.colOptions?.parsed_tree?.dataType === FormulaDataTypes.STRING) &&
    width - 24 <= defaultOffscreen2DContext.measureText(value?.toString() ?? '').width
  )
}

export const FormulaCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const {
      column,
      x,
      y,
      padding,
      isPg,
      value,
      width,
      pv,
      height,
      textColor = '#4a5268',
      mousePosition,
      setCursor,
      isUnderLookup,
    } = props
    const colMeta = parseProp(column.meta)
    if (parseProp(column.colOptions)?.error) {
      renderSingleLineText(ctx, {
        text: 'ERR!',
        x: x + padding,
        y,
      })
      return
    }

    const showAsLongText = !isUnderLookup && shouldShowAsLongText({ width, value, column })

    if (colMeta?.display_type || showAsLongText) {
      getDisplayValueCellRenderer(column, showAsLongText).render(ctx, {
        ...props,
        column: {
          ...column,
          uidt: colMeta?.display_type || UITypes.LongText,
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
    const { column, getCellPosition, value } = props

    const colObj = column.columnObj
    const colMeta = parseProp(colObj.meta)
    const error = parseProp(colObj.colOptions)?.error ?? ''

    const { x, y, width, height } = getCellPosition(column, props.row.rowMeta.rowIndex!)
    const baseStore = useBase()
    const { isPg } = baseStore

    // isUnderLookup is not present in props and also from lookup cell we are not triggering click event so no need to check isUnderLookup
    const showAsLongText = shouldShowAsLongText({ width, value, column: colObj })

    if (colMeta?.display_type || !error || showAsLongText) {
      // Call the display type cell renderer's handleClick method if it exists
      if (getDisplayValueCellRenderer(colObj, showAsLongText)?.handleClick) {
        return getDisplayValueCellRenderer(colObj, showAsLongText).handleClick!({
          ...props,
          column: {
            ...column,
            columnObj: {
              ...colObj,
              uidt: colMeta?.display_type || UITypes.LongText,
              ...colMeta.display_column_meta,
            },
          },
        })
      }
    }

    const result = isPg(column.columnObj.source_id) ? renderValue(handleTZ(props.value)) : renderValue(props.value)
    const urls = replaceUrlsWithLink(result)
    const padding = 10
    const maxWidth = width - padding * 2
    const pv = column.pv
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
    const { column, value, makeCellEditable, row } = props

    const colObj = column.columnObj

    // Todo: show inline warning
    if (props.e.key === 'Enter') {
      // isUnderLookup is not present in props and also from lookup cell we are not triggering click event so no need to check isUnderLookup
      const showAsLongText = shouldShowAsLongText({ width: parseInt(column.width) || 200, value, column: colObj })

      if (showAsLongText) {
        makeCellEditable(row.rowMeta.rowIndex!, column)

        return true
      }

      showFieldEditWarning()
      return true
    }
  },
  async handleHover(props) {
    const { mousePosition, getCellPosition, column, row, value } = props
    const colObj = column.columnObj
    const colMeta = parseProp(colObj.meta)
    const error = parseProp(colObj.colOptions)?.error ?? ''
    const { tryShowTooltip, hideTooltip } = useTooltipStore()
    hideTooltip()

    const { width } = getCellPosition(column, props.row.rowMeta.rowIndex!)

    // isUnderLookup is not present in props and also from lookup cell we are not triggering hover event so no need to check isUnderLookup
    const showAsLongText = shouldShowAsLongText({ width, value, column: colObj })

    if (colMeta?.display_type || !error || showAsLongText) {
      return getDisplayValueCellRenderer(colObj, showAsLongText)?.handleHover?.({
        ...props,
        column: {
          ...column,
          columnObj: {
            ...colObj,
            uidt: colMeta?.display_type || UITypes.LongText,
            ...colMeta.display_column_meta,
          },
        },
      })
    }
    const { x, y } = getCellPosition(column, row.rowMeta.rowIndex!)

    tryShowTooltip({ rect: { x: x + 10, y, height: 25, width: 45 }, mousePosition, text: error })
  },
}
