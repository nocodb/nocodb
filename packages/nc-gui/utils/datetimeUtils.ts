import { getTimeZones } from '@vvo/tzdb'
import dayjs from 'dayjs'
import { dateFormats, timeFormats, workerWithTimezone } from 'nocodb-sdk'

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
  const formats = [
    'YYYY-MM-DD',
    'YYYY/MM/DD',
    'YYYY MM DD',

    'DD-MM-YYYY',
    'DD/MM/YYYY',
    'DD MM YYYY',
    'DD.MM.YYYY',
    'DD.MM.YY',

    'MM-DD-YYYY',
    'MM/DD/YYYY',
    'MM DD YYYY',
  ]

  for (const format of formats) {
    const date = dayjs(dateString, format, true)
    if (date.isValid()) {
      return date
    }
  }
}

let timezones: ReturnType<typeof getTimeZones> | undefined
export function getTimeZoneFromName(name: string = Intl.DateTimeFormat().resolvedOptions().timeZone) {
  // Built on first use: ~50ms, and most screens never need it.
  timezones ??= getTimeZones({ includeUtc: true })
  let timezone = timezones.find((k) => isSameTimezone(k.name, name))

  if (!timezone) {
    timezone = timezones.find((k) => k.group.includes(name))
  }

  if (!timezone) {
    console.log('Timezone not found', name)
  }

  return timezone
}

// @vvo/tzdb holds one static abbreviation (NZST all year); Intl knows the DST name
export function getTimezoneAbbreviation(name?: string, date: Date = new Date()) {
  const timezone = getTimeZoneFromName(name)
  if (!timezone) return undefined
  try {
    const abbr = new Intl.DateTimeFormat(`en-${timezone.countryCode}`, {
      timeZone: name ?? timezone.name,
      timeZoneName: 'short',
    })
      .formatToParts(date)
      .find((p) => p.type === 'timeZoneName')?.value
    // Intl has no name for many zones and falls back to "GMT+9"
    if (abbr && !/^(GMT|UTC)[+-]/.test(abbr)) return abbr
  } catch {}
  return timezone.abbreviation
}

export function withTimezone(timezone?: string) {
  return workerWithTimezone(isEeUI, timezone)
}
