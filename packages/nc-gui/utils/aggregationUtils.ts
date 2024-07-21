import {
  AttachmentAggregations,
  BooleanAggregations,
  type ColumnType,
  CommonAggregations,
  DateAggregations,
  UITypes,
  dateFormats,
  timeFormats,
} from 'nocodb-sdk'
import dayjs from 'dayjs'

const getDateValue = (modelValue: string | null | number, col: ColumnType, isSystemCol?: boolean) => {
  const dateFormat = !isSystemCol ? parseProp(col.meta)?.date_format ?? 'YYYY-MM-DD' : 'YYYY-MM-DD HH:mm:ss'
  if (!modelValue || !dayjs(modelValue).isValid()) {
    return ''
  }
  return dayjs(/^\d+$/.test(String(modelValue)) ? +modelValue : modelValue).format(dateFormat)
}

const roundTo = (num: unknown, precision = 1) => {
  if (!num || Number.isNaN(num)) return num
  const factor = 10 ** precision
  return Math.round(+num * factor) / factor
}

const getDateTimeValue = (modelValue: string | null, col: ColumnType, isXcdbBase?: boolean) => {
  if (!modelValue || !dayjs(modelValue).isValid()) {
    return ''
  }

  const dateFormat = parseProp(col?.meta)?.date_format ?? dateFormats[0]
  const timeFormat = parseProp(col?.meta)?.time_format ?? timeFormats[0]
  const dateTimeFormat = `${dateFormat} ${timeFormat}`

  if (!isXcdbBase) {
    return dayjs(/^\d+$/.test(modelValue) ? +modelValue : modelValue, dateTimeFormat).format(dateTimeFormat)
  }

  return dayjs(modelValue).utc().local().format(dateTimeFormat)
}

const getCurrencyValue = (modelValue: string | number | null | undefined, col: ColumnType): string => {
  const currencyMeta = {
    currency_locale: 'en-US',
    currency_code: 'USD',
    ...parseProp(col.meta),
  }
  try {
    if (modelValue === null || modelValue === undefined || Number.isNaN(modelValue)) {
      return modelValue === null || modelValue === undefined ? '' : (modelValue as string)
    }
    return new Intl.NumberFormat(currencyMeta.currency_locale || 'en-US', {
      style: 'currency',
      currency: currencyMeta.currency_code || 'USD',
    }).format(+modelValue)
  } catch (e) {
    return modelValue as string
  }
}

export function formatBytes(bytes, decimals = 2, base = 1000) {
  if (bytes === 0) return '0 Bytes'

  const k = base
  const dm = Math.max(0, decimals)
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${(bytes / k ** i).toFixed(dm)} ${sizes[i]}`
}

const formatAggregation = (aggregation: any, value: any, column: ColumnType) => {
  if ([DateAggregations.EarliestDate, DateAggregations.LatestDate].includes(aggregation)) {
    if (column.uidt === UITypes.DateTime) {
      return getDateTimeValue(value, column)
    } else if (column.uidt === UITypes.Date) {
      return getDateValue(value, column)
    }
    return getDateTimeValue(value, column)
  }

  if (
    [
      CommonAggregations.PercentEmpty,
      CommonAggregations.PercentFilled,
      CommonAggregations.PercentUnique,
      BooleanAggregations.PercentChecked,
      BooleanAggregations.PercentUnchecked,
    ].includes(aggregation)
  ) {
    return `${roundTo(value, 1) ?? 0}%`
  }

  if ([DateAggregations.MonthRange, DateAggregations.DateRange].includes(aggregation)) {
    return aggregation === DateAggregations.DateRange ? `${value ?? 0} days` : `${value ?? 0} months`
  }

  if (
    [
      CommonAggregations.Count,
      CommonAggregations.CountEmpty,
      CommonAggregations.CountFilled,
      CommonAggregations.CountUnique,
    ].includes(aggregation)
  ) {
    return value
  }

  if ([AttachmentAggregations.AttachmentSize].includes(aggregation)) {
    return formatBytes(value ?? 0)
  }

  if (column.uidt === UITypes.Currency) {
    return getCurrencyValue(value, column)
  }

  if (column.uidt === UITypes.Percent) {
    return `${roundTo(value, 1)}%`
  }

  if (column.uidt === UITypes.Duration) {
    return convertMS2Duration(value, parseProp(column.meta)?.duration || 0)
  }
  if (typeof value === 'number') {
    return roundTo(value, 1) ?? '∞'
  }

  return value
}

export { formatAggregation }
