import { UITypes } from 'nocodb-sdk'
import { getCheckboxValue } from './parsers/parserHelpers'

/*
 * @param {string} str - string with numbers
 * @returns {number} - number extracted from string
 *
 * @example abc123 -> 123
 * @example 12.3abc -> 12.3
 * @example 12.3.2 -> 12.32
 */
function extractNumbers(str: string): number {
  const parts = str.replace(/[^\d.]/g, '').split('.')

  if (parts.length > 1) parts[0] += '.'

  if (str.startsWith('-')) parts.unshift('-')

  return parseFloat(parts.join(''))
}

/*
 * @param {string} value - string value of duration
 * @returns {number} - duration in seconds
 *
 * @example 1:30:00 -> 5400
 * @example 1:30 -> 5400
 * @example 90 -> 90
 */
function toDuration(value: string) {
  if (value.includes(':')) {
    const [hours, minutes, seconds] = value.split(':').map((v) => parseInt(v) || 0)
    return hours * 3600 + minutes * 60 + seconds
  }

  return Math.floor(extractNumbers(value))
}

/*
 * @param {string} value - string value to convert
 * @param {string} type - type of the field to convert to
 * @returns {number|string|boolean|array} - converted value
 *
 * @example convert('12.3', 'Number') -> 12
 * @example convert('1a23', 'SingleLineText') -> '1a23'
 * @example convert('1', 'Checkbox') -> true
 */
export function convert(value: string, type: string, limit = 100): unknown {
  switch (type) {
    case UITypes.SingleLineText:
    case UITypes.SingleSelect:
    case UITypes.LongText:
    case UITypes.Email:
    case UITypes.URL:
      return value
    case UITypes.Number:
      return Math.floor(extractNumbers(value))
    case UITypes.Decimal:
    case UITypes.Currency:
      return extractNumbers(value)
    case UITypes.Percent:
    case UITypes.Rating:
      return Math.min(limit, Math.max(0, extractNumbers(value)))
    case UITypes.Checkbox:
      return getCheckboxValue(value)
    case UITypes.Date:
    case UITypes.DateTime:
    case UITypes.Time:
      return new Date(value)
    case UITypes.Duration:
      return toDuration(value)
    case UITypes.MultiSelect:
      return value.split(',').map((v) => v.trim())
  }
}
