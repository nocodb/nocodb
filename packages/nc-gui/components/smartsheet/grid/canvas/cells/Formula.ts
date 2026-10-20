import {
  type ColumnType,
  FormulaDataTypes,
  type SelectOptionsType,
  UITypes,
  getEffectiveDisplayColumn,
  handleTZ,
  isFormulaNonFiniteValue,
} from 'nocodb-sdk'
import {
  defaultOffscreen2DContext,
  isBoxHovered,
  renderFormulaURL,
  renderIconButton,
  renderSingleLineText,
} from '../utils/canvas'
import { getSingleMultiselectColOptions, showFieldEditWarning } from '../utils/cell'
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
import { SingleSelectCellRenderer } from './SingleSelect'
import { MultiSelectCellRenderer } from './MultiSelect'
import { LookupCellRenderer } from './Lookup'
import { UserFieldCellRenderer } from './User'
import { BarcodeCellRenderer } from './Barcode'
import { QRCodeCellRenderer } from './QRCode'
import { AttachmentCellRenderer } from './Attachment'

function getDisplayValueCellRenderer(column: ColumnType) {
  const colExtra = column.extra
  const modifiedColumn = {
    uidt: colExtra?.display_type,
    ...colExtra?.display_column_meta,
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
  else if (isTextArea(modifiedColumn)) return LongTextCellRenderer
  else if (isSingleSelect(modifiedColumn)) return SingleSelectCellRenderer
  else if (isMultiSelect(modifiedColumn)) return MultiSelectCellRenderer
  else if (isBarcode(modifiedColumn)) return BarcodeCellRenderer
  else if (isQrCode(modifiedColumn)) return QRCodeCellRenderer
  else if (isAttachment(modifiedColumn)) return AttachmentCellRenderer
  else if (isUser(modifiedColumn)) return UserFieldCellRenderer
  else if (isLookup(modifiedColumn)) return LookupCellRenderer
  // TODO: handle LTAR
  // LtarCellModifier need array of key value object as data
  // else if (isLTAR(modifiedColumn.uidt, modifiedColumn.colOptions)) return LtarCellRenderer
  else if (isMultiSelect(modifiedColumn)) return MultiSelectCellRenderer
  else return SingleLineTextCellRenderer
}

// Select options map per display options object, so it is built once rather than per cell
const displaySelectExtraCache = new WeakMap<object, ReturnType<typeof getSingleMultiselectColOptions>>()

function getDisplaySelectColumn(displayColumn: ColumnType): ColumnType {
  // A formula referencing a select field already carries that field's extra
  if ((displayColumn.extra as any)?.optionsMap || !displayColumn.colOptions) return displayColumn

  const cacheKey = displayColumn.colOptions as object
  let extra = displaySelectExtraCache.get(cacheKey)
  if (!extra || extra.isColorCodeEnabled !== (parseProp(displayColumn.meta)?.isColorCodeEnabled !== false)) {
    // copy: the helper writes `value` and normalises titles on the options it is given,
    // and these are the column's stored display options
    const options = (displayColumn.colOptions as SelectOptionsType).options ?? []
    extra = getSingleMultiselectColOptions({ ...displayColumn, colOptions: { options: options.map((op) => ({ ...op })) } })
    displaySelectExtraCache.set(cacheKey, extra)
  }

  return { ...displayColumn, extra }
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
      textColor = themeV4Colors.gray['600'],
      getColor,
      mousePosition,
      setCursor,
      spriteLoader,
      selected,
    } = props
    const colExtra = column.extra

    if (parseProp(column.colOptions)?.error) {
      // Same fillStyle requirement as the IEEE branch below — without it this
      // inherited the previous cell's colour and rendered invisibly on rows
      // whose neighbouring cells were blank.
      renderSingleLineText(ctx, {
        text: 'ERR!',
        x: x + padding,
        y,
        maxWidth: width - padding * 2,
        fontFamily: `${pv ? 600 : 500} 13px Inter`,
        fillStyle: getColor(themeV4Colors.orange['700']),
        height,
      })
      return
    }

    // pg IEEE value for this row — distinct from the column-level error above.
    // Numeric formulas only: a string formula returning the literal "Infinity"
    // is an ordinary result. fillStyle is mandatory: canvas state carries over
    // between cells, so omitting it paints this text in whatever colour the
    // previous cell left behind — invisible on rows whose neighbours were blank.
    if (column?.colOptions?.parsed_tree?.dataType === FormulaDataTypes.NUMERIC && isFormulaNonFiniteValue(value)) {
      renderSingleLineText(ctx, {
        text: String(value),
        x: x + padding,
        y,
        maxWidth: width - padding * 2,
        fontFamily: `${pv ? 600 : 500} 13px Inter`,
        fillStyle: getColor(themeV4Colors.orange['700']),
        height,
      })
      return
    }

    // If Custom Formatting is applied to the column, render the cell using the display type cell renderer
    if (colExtra?.display_type) {
      let displayColumn = getEffectiveDisplayColumn(colExtra, column)
      let displayValue = value

      if (colExtra.display_type === UITypes.SingleSelect || colExtra.display_type === UITypes.MultiSelect) {
        displayColumn = getDisplaySelectColumn(displayColumn)
        if (colExtra.display_type === UITypes.SingleSelect) displayValue = getFormulaSelectDisplayValue(value, displayColumn)
      }

      getDisplayValueCellRenderer(column).render(ctx, {
        ...props,
        value: displayValue,
        column: displayColumn,
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
        ctx.font = `${pv ? 600 : 500} 13px Inter`
        ctx.fillStyle = pv ? getColor(themeV4Colors.brand['500']) : getColor(textColor)
        const boxes = renderFormulaURL(ctx, {
          htmlText: urls,
          height,
          maxWidth,
          x: x + padding,
          y: y + 3,
          lineHeight: 16,
          getColor,
        })
        const hoveredBox = boxes.find((box) => isBoxHovered(box, mousePosition))
        if (hoveredBox && selected) {
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

      if (selected) {
        renderIconButton(ctx, {
          buttonX: x + width - 28,
          buttonY: y + 7,
          buttonSize: 20,
          borderRadius: 6,
          iconData: {
            size: 12,
            xOffset: 4,
            yOffset: 4,
            color: getColor(themeV4Colors.gray['700']),
          },
          mousePosition,
          spriteLoader,
          icon: 'maximize',
          background: getColor(themeV4Colors.base.white),
          borderColor: getColor(themeV4Colors.gray['200']),
          hoveredBackground: getColor(themeV4Colors.gray['100']),
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
    const { column, getCellPosition, value, openDetachedLongText, selected, isDoubleClick, mousePosition, getColor } = props
    if (!selected && !isDoubleClick) return false

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
            columnObj: getEffectiveDisplayColumn(colMeta, colObj),
          },
          formula: true,
          getColor,
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
        ctx.font = `${pv ? 600 : 500} 13px Inter`
        const boxes = renderFormulaURL(ctx, {
          htmlText: urls,
          height,
          maxWidth,
          x: x + padding,
          y: y + 3,
          lineHeight: 16,
          getColor,
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
    const { mousePosition, getCellPosition, column, row, selected, t } = props
    const colObj = column.columnObj
    const colMeta = parseProp(colObj.meta)
    const error = parseProp(colObj.colOptions)?.error ?? ''
    const { tryShowTooltip, hideTooltip } = useTooltipStore()
    hideTooltip()

    if (colMeta?.display_type) {
      let displayColumn = getEffectiveDisplayColumn(colMeta, colObj)
      if (colMeta.display_type === UITypes.SingleSelect || colMeta.display_type === UITypes.MultiSelect) {
        displayColumn = getDisplaySelectColumn(displayColumn)
      }

      return getDisplayValueCellRenderer(colObj)?.handleHover?.({
        ...props,
        value:
          colMeta.display_type === UITypes.SingleSelect ? getFormulaSelectDisplayValue(props.value, displayColumn) : props.value,
        column: {
          ...column,
          columnObj: displayColumn,
        },
      })
    }

    const { x, y, width } = getCellPosition(column, row.rowMeta.rowIndex!)

    if (selected && colObj?.colOptions?.parsed_tree?.dataType === FormulaDataTypes.STRING) {
      tryShowTooltip({
        rect: {
          x: x + width - 28,
          y: y + 7,
          width: 18,
          height: 18,
        },
        mousePosition,
        text: t('tooltip.expandShiftSpace'),
      })
    }

    tryShowTooltip({ rect: { x: x + 10, y, height: 25, width: 45 }, mousePosition, text: error })
  },
}
