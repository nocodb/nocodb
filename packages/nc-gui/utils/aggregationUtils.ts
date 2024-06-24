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
  } else {
    return dayjs(/^\d+$/.test(String(modelValue)) ? +modelValue : modelValue).format(dateFormat)
  }
}

const roundTo = (num: unknown, precision: number) => {
  if (!num || Number.isNaN(num)) return num
  const factor = 10 ** precision
  return Math.round(+num * factor) / factor
}

const getDateTimeValue = (modelValue: string | null, col: ColumnType) => {
  if (!modelValue || !dayjs(modelValue).isValid()) {
    return ''
  }

  const dateFormat = parseProp(col?.meta)?.date_format ?? dateFormats[0]
  const timeFormat = parseProp(col?.meta)?.time_format ?? timeFormats[0]
  const dateTimeFormat = `${dateFormat} ${timeFormat}`

  return dayjs(modelValue).utc().local().format(dateTimeFormat)
}

const getCurrencyValue = (modelValue: string | number | null | undefined, col: ColumnType): string => {
  const currencyMeta = {
    currency_locale: 'en-US',
    currency_code: 'USD',
    ...parseProp(col.meta),
  }
  try {
    if (modelValue === null || modelValue === undefined || isNaN(modelValue)) {
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

function formatBytes(bytes, decimals = 2) {
  if (!+bytes) return '0 Bytes'

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB']

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / k ** i).toFixed(dm))} ${sizes[i]}`
}

const formatAggregation = (aggregation: any, value: any, column: ColumnType) => {
  if ([DateAggregations.EarliestDate, DateAggregations.LatestDate].includes(aggregation)) {
    if (column.uidt === UITypes.DateTime) {
      return getDateTimeValue(value, column)
    } else if (column.uidt === UITypes.Date) {
      return getDateValue(value, column)
    } else {
      return getDateTimeValue(value, column)
    }
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
    return `${roundTo(value, 2) ?? 0}%`
  }

  if ([DateAggregations.MonthRange, DateAggregations.DateRange].includes(aggregation)) {
    return aggregation === DateAggregations.DateRange ? `${value} days` : `${value} months`
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
    return `${roundTo(value, 2)}%`
  }

  if (column.uidt === UITypes.Duration) {
    return convertMS2Duration(value, parseProp(column.meta)?.duration || 0)
  }

  return roundTo(value, 2) ?? '∞'
}

export { formatAggregation }
