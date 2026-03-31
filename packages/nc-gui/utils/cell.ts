import type { ColumnType, TableType } from 'nocodb-sdk'
import { UITypes, ncIsNaN, roundUpToPrecision } from 'nocodb-sdk'
import tinycolor from 'tinycolor2'
import type { HTMLAttributes } from 'vue'

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
  isColour,
  isSpecificDBType,
  isGeometry,
  isUUID,
  isAutoNumber,
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
    UITypes.UUID,
  ].includes(column.uidt as UITypes)
}

export const getSelectTypeOptionTextColor = (
  color: string | null | undefined,
  getColor: GetColorType,
  disableGetColor = false,
): string => {
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

export const getSelectTypeFieldOptionBgColor = ({
  color,
  isDark,
  shade,
  getColor,
  isColorCodeEnabled = true,
}: {
  color?: string
  isDark: boolean
  shade?: number
  getColor?: GetColorType
  isColorCodeEnabled?: boolean
}) => {
  if (!isColorCodeEnabled && getColor) {
    return getColor('var(--nc-bg-gray-medium)', 'var(--nc-bg-gray-light)')
  }

  return !isDark
    ? getAdaptiveTint(color || '#e7e7e9', { saturationMod: 5, isDarkMode: isDark, shade: shade ?? 20 })
    : getAdaptiveTint(color || '#e7e7e9', { isDarkMode: isDark, shade: shade ?? -10 })
}

export const getDarkModeCompatibleBgColor = ({ color, isDark, shade }: { color?: string; isDark: boolean; shade?: number }) => {
  return !isDark ? color : getAdaptiveTint(color || '#e7e7e9', { isDarkMode: isDark, shade: shade ?? -10 })
}

export const getSelectTypeFieldOptionTextColor = ({
  color,
  isDark,
  getColor,
  isColorCodeEnabled = true,
}: {
  color?: string
  isDark: boolean
  getColor: GetColorType
  isColorCodeEnabled?: boolean
}) => {
  if (!isColorCodeEnabled) {
    return getColor('var(--nc-content-gray)')
  }

  return getOppositeColorOfBackground(getSelectTypeFieldOptionBgColor({ color, isDark }), color)
}

export const getInputModeFromUITypes = (uidt: UITypes): HTMLAttributes['inputmode'] => {
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
export const isColumnDateDependencyField = (meta: TableType | undefined, columnId?: string): boolean => {
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

export const formatPercentage = (n: number, precision = 2) => {
  if (ncIsNaN(n)) return '0%'

  return n % 1 === 0 ? `${n}%` : `${roundUpToPrecision(n, precision)}%`
}
