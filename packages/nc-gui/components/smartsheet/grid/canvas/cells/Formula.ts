import { type ColumnType } from 'nocodb-sdk'
import { renderSingleLineText } from '../utils/canvas'
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
    const { column, x, y, padding } = props
    const colMeta = parseProp(column.meta)

    if (colMeta?.display_type) {
      getDisplayValueCellRenderer(column).render(ctx, props)
    } else {
      if (parseProp(column.colOptions)?.error) {
        renderSingleLineText(ctx, {
          text: 'ERR!',
          x: x + padding,
          y,
        })
        return
      }
      SingleLineTextCellRenderer.render(ctx, props)
    }
  },
  handleClick: async () => {},
}
