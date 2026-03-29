import type { ColumnType, TableType } from 'nocodb-sdk'
import type { HTMLAttributes } from 'vue'
import { ncIsNaN, roundUpToPrecision, UITypes } from 'nocodb-sdk'
import tinycolor from 'tinycolor2'

export {
  dataTypeLow,
  isAI,
  isAiButton,
  isAttachment,
  isAutoNumber,
  isAutoSaved,
  isBoolean,
  isButton,
  isColour,
  isCurrency,
  isDate,
  isDateTime,
  isDecimal,
  isDuration,
  isEmail,
  isEnum,
  isFloat,
  isGeoData,
  isGeometry,
  isInt,
  isJSON,
  isManualSaved,
  isMultiSelect,
  isNumericFieldType,
  isPercent,
  isPhoneNumber,
  isPrimary,
  isPrimaryKey,
  isRating,
  isReadonlyDateTime,
  isReadonlyUser,
  isRichText,
  isScriptButton,
  isSet,
  isSingleSelect,
  isSpecificDBType,
  isString,
  isTextArea,
  isTime,
  isURL,
  isUser,
  isUUID,
  isYear,
  renderValue,
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

export function rowHeightTruncateLines(rowHeightOrHeighInPx?: number, isSelectOption = false) {
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

export function isShowNullField(column: ColumnType) {
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
    UITypes.UUID,
  ].includes(column.uidt as UITypes)
}

export function getSelectTypeOptionTextColor(color: string | null | undefined, getColor: GetColorType, disableGetColor = false): string {
  color = color ?? disableGetColor ? color || '#ccc' : getColor('var(--nc-bg-gray-medium)', 'var(--nc-bg-gray-light)') // Set default only if color is null or undefined

  return tinycolor.isReadable(color, '#fff', { level: 'AA', size: 'large' })
    ? '#fff'
    : tinycolor
        .mostReadable(color, [
          disableGetColor ? '#0b1d05' : getColor('var(--nc-content-gray)', 'var(--nc-content-gray-subtle2)'),
          '#fff',
        ])
        .toHex8String()
}

export function getSelectTypeFieldOptionBgColor({
  color,
  isDark,
  shade,
}: {
  color?: string
  isDark: boolean
  shade?: number
}) {
  return !isDark
    ? getAdaptiveTint(color || '#e7e7e9', { saturationMod: 5, isDarkMode: isDark, shade: shade ?? 20 })
    : getAdaptiveTint(color || '#e7e7e9', { isDarkMode: isDark, shade: shade ?? -10 })
}

export function getDarkModeCompatibleBgColor({ color, isDark, shade }: { color?: string, isDark: boolean, shade?: number }) {
  return !isDark ? color : getAdaptiveTint(color || '#e7e7e9', { isDarkMode: isDark, shade: shade ?? -10 })
}

export function getSelectTypeFieldOptionTextColor({
  color,
  isDark,
  getColor: _getColor,
}: {
  color?: string
  isDark: boolean
  getColor: GetColorType
}) {
  return getOppositeColorOfBackground(getSelectTypeFieldOptionBgColor({ color, isDark }), color)
}

export function getInputModeFromUITypes(uidt: UITypes): HTMLAttributes['inputmode'] {
  if ([UITypes.Number, UITypes.Year, UITypes.Rating].includes(uidt)) {
    return 'numeric'
  }

  if ([UITypes.Decimal, UITypes.Percent, UITypes.Currency].includes(uidt)) {
    return 'decimal'
  }

  if (uidt === UITypes.Email) {
    return 'email'
  }

  if (uidt === UITypes.PhoneNumber) {
    return 'tel'
  }

  if (uidt === UITypes.URL) {
    return 'url'
  }
}

/**
 * Check if a column is part of an active date dependency rule on the table.
 */
export function isColumnDateDependencyField(meta: TableType | undefined, columnId?: string): boolean {
  if (!columnId) return false
  const rule = meta?.date_dependency
  if (!rule?.is_active) return false

  return [
    rule.fk_start_date_field_id,
    rule.fk_end_date_field_id,
    rule.fk_duration_field_id,
    rule.fk_dependency_linkrow_field_id,
  ].includes(columnId)
}

export function formatPercentage(n: number, precision = 2) {
  if (ncIsNaN(n)) return '0%'

  return n % 1 === 0 ? `${n}%` : `${roundUpToPrecision(n, precision)}%`
}
