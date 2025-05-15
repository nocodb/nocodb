import type { ColumnType } from 'nocodb-sdk'
import { UITypes } from 'nocodb-sdk'
import tinycolor from 'tinycolor2'

export {
  dataTypeLow,
  isBoolean,
  isString,
  isTextArea,
  isRichText,
  isInt,
  isFloat,
  isDate,
  isYear,
  isTime,
  isDateTime,
  isReadonlyDateTime,
  isReadonlyUser,
  isJSON,
  isEnum,
  isSingleSelect,
  isSet,
  isMultiSelect,
  isURL,
  isEmail,
  isAttachment,
  isRating,
  isCurrency,
  isPhoneNumber,
  isDecimal,
  isDuration,
  isGeoData,
  isPercent,
  isSpecificDBType,
  isGeometry,
  isUser,
  isButton,
  isAiButton,
  isScriptButton,
  isAI,
  isAutoSaved,
  isManualSaved,
  isPrimary,
  isPrimaryKey,
  renderValue,
  isNumericFieldType,
} from 'nocodb-sdk'

export const rowHeightInPx: Record<string, number> = {
  1: 32,
  2: 60,
  4: 90,
  6: 120,
}

export const pxToRowHeight: Record<number, number> = {
  32: 1,
  60: 2,
  90: 4,
  120: 6,
}

export const rowHeightTruncateLines = (rowHeightOrHeighInPx?: number, isSelectOption = false) => {
  switch (rowHeightOrHeighInPx) {
    case 2:
    case 60:
      return 2
    case 4:
    case 90:
      return isSelectOption ? 3 : 4
    case 6:
    case 120:
      return isSelectOption ? 4 : 6
    default:
      return 1
  }
}

export const isShowNullField = (column: ColumnType) => {
  return [
    UITypes.SingleLineText,
    UITypes.LongText,
    UITypes.PhoneNumber,
    UITypes.Email,
    UITypes.URL,
    UITypes.Number,
    UITypes.Decimal,
    UITypes.Percent,
    UITypes.Duration,
    UITypes.JSON,
    UITypes.Geometry,
    UITypes.GeoData,
    UITypes.Date,
    UITypes.DateTime,
    UITypes.Time,
    UITypes.Year,
    UITypes.Currency,
    UITypes.Formula,
  ].includes(column.uidt as UITypes)
}

export const getSelectTypeOptionTextColor = (color?: string | null): string => {
  color = color ?? '#ccc' // Set default only if color is null or undefined

  return tinycolor.isReadable(color, '#fff', { level: 'AA', size: 'large' })
    ? '#fff'
    : tinycolor.mostReadable(color, ['#0b1d05', '#fff']).toHex8String()
}
