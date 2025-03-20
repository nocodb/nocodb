import { type ColumnType, FormulaDataTypes, UITypes, handleTZ } from 'nocodb-sdk'
import {
  defaultOffscreen2DContext,
  isBoxHovered,
  renderFormulaURL,
  renderIconButton,
  renderSingleLineText,
} from '../utils/canvas'
import { showFieldEditWarning } from '../utils/cell'
import { getI18n } from '../../../../../plugins/a.i18n'
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
      spriteLoader,
    } = props
    const colMeta = parseProp(column.meta)

    const isHovered = isBoxHovered({ x, y, width, height }, mousePosition)

    if (parseProp(column.colOptions)?.error) {
      renderSingleLineText(ctx, {
        text: 'ERR!',
        x: x + padding,
        y,
      })
      return
    }

    // If Custom Formatting is applied to the column, render the cell using the display type cell renderer
    if (colMeta?.display_type) {
      getDisplayValueCellRenderer(column).render(ctx, {
        ...props,
        column: {
          ...column,
          uidt: colMeta?.display_type || UITypes.LongText,
          ...colMeta.display_column_meta,
        },
        readonly: true,
        formula: true,
      })
      return
    }

    const result = isPg(column.source_id) ? renderValue(handleTZ(value)) : renderValue(value)

    // If the resultant type is Numeric, render as a Numeric Field
    if (column?.colOptions?.parsed_tree?.dataType === FormulaDataTypes.NUMERIC) {
      FloatCellRenderer.render(ctx, {
        ...props,
        value: result,
        formula: true,
      })
      return
    }

    //  Render as String
    if (column?.colOptions?.parsed_tree?.dataType === FormulaDataTypes.STRING) {
      // This returns a false, if the field does not contain any URL
      const urls = replaceUrlsWithLink(result)
      const maxWidth = width - padding * 2
      // If the field uses URL formula render it as a clickable link
      if (typeof urls === 'string') {
        ctx.font = `${pv ? 600 : 500} 13px Manrope`
        ctx.fillStyle = pv ? '#3366FF' : textColor
        const boxes = renderFormulaURL(ctx, {
          htmlText: urls,
          height,
          maxWidth,
          x: x + padding,
          y: y + 3,
          lineHeight: 16,
        })
        const hoveredBox = boxes.find((box) => isBoxHovered(box, mousePosition))
        if (hoveredBox) {
          setCursor('pointer')
        }
      } else {
        // If it does not contaisn urls, render as a SingleLineText
        SingleLineTextCellRenderer.render(ctx, {
          ...props,
          value: result,
          formula: true,
        })
      }

      if (isHovered) {
        renderIconButton(ctx, {
          buttonX: x + width - 28,
          buttonY: y + 7,
          buttonSize: 20,
          borderRadius: 6,
          iconData: {
            size: 13,
            xOffset: (20 - 13) / 2,
            yOffset: (20 - 13) / 2,
          },
          mousePosition,
          spriteLoader,
          icon: 'maximize',
          background: 'white',
          setCursor,
        })
      }
    } else {
      // If not of type string render as a SingleLineText
      SingleLineTextCellRenderer.render(ctx, {
        ...props,
        value: result,
        formula: true,
      })
    }
  },
  handleClick: async (props) => {
    const { column, getCellPosition, value, openDetachedLongText, selected, mousePosition } = props

    const colObj = column.columnObj
    const colMeta = parseProp(colObj.meta)
    const error = parseProp(colObj.colOptions)?.error ?? ''

    const { x, y, width, height } = getCellPosition(column, props.row.rowMeta.rowIndex!)

    const baseStore = useBase()
    const { isPg } = baseStore

    // isUnderLookup is not present in props and also from lookup cell we are not triggering click event so no need to check isUnderLookup
    if (colMeta?.display_type || !error) {
      // Call the display type cell renderer's handleClick method if it exists
      if (getDisplayValueCellRenderer(colObj)?.handleClick) {
        return getDisplayValueCellRenderer(colObj).handleClick!({
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
    }

    const result = isPg(column.columnObj.source_id) ? renderValue(handleTZ(props.value)) : renderValue(props.value)

    if (column.columnObj?.colOptions?.parsed_tree?.dataType === FormulaDataTypes.STRING) {
      const urls = replaceUrlsWithLink(result)
      const padding = 10
      const maxWidth = width - padding * 2
      const pv = column.pv

      // If CLicked on Expand icon
      if (isBoxHovered({ x: x + width - 28, y: y + 7, width: 18, height: 18 }, mousePosition)) {
        openDetachedLongText({ column: colObj, vModel: value })
        return true
      }

      if (typeof urls === 'string') {
        const ctx = defaultOffscreen2DContext
        ctx.font = `${pv ? 600 : 500} 13px Manrope`
        const boxes = renderFormulaURL(ctx, {
          htmlText: urls,
          height,
          maxWidth,
          x: x + padding,
          y: y + 3,
          lineHeight: 16,
        })

        // If clicked on url or other texts
        // If clicked on URL, open the URL in a new tab
        // If selected and clicked, open the detached long text
        const hoveredBox = boxes.find((box) => isBoxHovered(box, props.mousePosition))
        if (hoveredBox) {
          confirmPageLeavingRedirect(hoveredBox.url, '_blank')
        } else if (selected) {
          openDetachedLongText({ column: colObj, vModel: value })
        }
      }
      // If double-clicked on the cell, open the detached long text
      if (props.event?.detail === 2) {
        openDetachedLongText({ column: colObj, vModel: value })
        return true
      }
    }

    // Todo: show inline warning
    if (props.event?.detail === 2) {
      showFieldEditWarning()
      return true
    }
    return false
  },
  handleKeyDown: async (props) => {
    const { column, value, openDetachedLongText } = props

    const colObj = column.columnObj

    // Todo: show inline warning
    if (props.e.key === 'Enter' || (props.e.key === ' ' && props.e.shiftKey)) {
      if (!isDrawerOrModalExist() && colObj?.colOptions?.parsed_tree?.dataType === FormulaDataTypes.STRING) {
        openDetachedLongText({ column: colObj, vModel: value })
        return
      }

      if (props.e.key === ' ' && props.e.shiftKey) return
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

    if (colMeta?.display_type) {
      return getDisplayValueCellRenderer(colObj)?.handleHover?.({
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
    const { x, y, width } = getCellPosition(column, row.rowMeta.rowIndex!)

    tryShowTooltip({
      rect: {
        x: x + width - 28,
        y: y + 7,
        width: 18,
        height: 18,
      },
      mousePosition,
      text: getI18n().global.t('tooltip.expandShiftSpace'),
    })

    tryShowTooltip({ rect: { x: x + 10, y, height: 25, width: 45 }, mousePosition, text: error })
  },
}
