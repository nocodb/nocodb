import { getTimeZones } from '@vvo/tzdb'
import dayjs from 'dayjs'
import { dateFormats, timeFormats } from 'nocodb-sdk'
import { workerWithTimezone } from './worker/datetimeUtils'
export { constructDateFormat, constructDateTimeFormat, constructTimeFormat } from 'nocodb-sdk'

export function parseStringDateTime(v: string, dateTimeFormat = `${dateFormats[0]} ${timeFormats[0]}`, toLocal = true) {
  const dayjsObj = toLocal ? dayjs(v).local() : dayjs(v)

  if (dayjsObj.isValid()) {
    v = dayjsObj.format(dateTimeFormat)
  } else {
    v = toLocal ? dayjs(v, dateTimeFormat).local().format(dateTimeFormat) : dayjs(v, dateTimeFormat).format(dateTimeFormat)
  }

  return v
}

export const timeAgo = (date: string) => {
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(date)) {
    // if there is no timezone info, consider as UTC
    // e.g. 2023-01-01 08:00:00 (MySQL)
    date += '+00:00'
  }
  // show in local time
  const diff = dayjs().diff(date)

  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const months = Math.floor(days / 30)
  const years = Math.floor(days / 365)

  if (seconds < 60) {
    if (seconds < 0) return '1s ago'
    return `${seconds}s ago`
  }
  if (minutes < 60) {
    return `${minutes}m ago`
  }
  if (hours < 24) {
    return `${hours}h ago`
  }
  if (days < 30) {
    return `${days}d ago`
  }
  if (months < 12) {
    return `${months}mo ago`
  }
  if (years < 1) {
    return `1y ago`
  }

  return `${years}y ago`
}

export const hookLogFormatter = (date: string) => {
  return date && dayjs(date).format('HH:mm:ss • DD MMMM YYYY')
}

export function parseFlexibleDate(dateString: string) {
  const formats = ['YYYY-MM-DD', 'YYYY/MM/DD', 'DD/MM/YYYY', 'DD-MM-YYYY', 'MM/DD/YYYY', 'MM-DD-YYYY']

  for (const format of formats) {
    const date = dayjs(dateString, format, true)
    if (date.isValid()) {
      return date
    }
  }
}

const timezones = getTimeZones({ includeUtc: true })
export function getTimeZoneFromName(name: string = Intl.DateTimeFormat().resolvedOptions().timeZone) {
  return timezones.find((k) => isSameTimezone(k.name, name))
}

export function withTimezone(timezone?: string) {
  return workerWithTimezone(isEeUI, timezone)
}
