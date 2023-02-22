import dayjs from 'dayjs'

export const timeAgo = (date: any) => {
  return dayjs.utc(date).fromNow()
}

export const dateFormats = [
  'YYYY-MM-DD',
  'YYYY/MM/DD',
  'DD-MM-YYYY',
  'MM-DD-YYYY',
  'DD/MM/YYYY',
  'MM/DD/YYYY',
  'DD MM YYYY',
  'MM DD YYYY',
  'YYYY MM DD',
]

export const isoToDate = (iso8601: string, ignoreTimezone = false) => {
  // Differences from default `new Date()` are...
  // - Returns a local datetime for all without-timezone inputs, including date-only strings.
  // - ignoreTimezone processes datetimes-with-timezones as if they are without-timezones.
  // - Accurate across all mobile browsers.  https://stackoverflow.com/a/61242262/25197

  const dateTimeParts = iso8601.match(
    /(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d{0,7}))?(?:([+-])(\d{2}):(\d{2}))?)?/,
  )

  if (!dateTimeParts) {
    return
  }

  // Create a "localized" Date.
  // If you create a date (without specifying time), you get a date set in UTC Zulu at midnight.
  // https://www.diigo.com/0hc3eb
  const date = new Date(
    Number(dateTimeParts[1]), // year
    Number(dateTimeParts[2]) - 1, // month (0-indexed)
    Number(dateTimeParts[3]) || 1, // day
    Number(dateTimeParts[4]) || 0, // hours
    Number(dateTimeParts[5]) || 0, // minutes
    Number(dateTimeParts[6]) || 0, // seconds
    Number(dateTimeParts[7]) || 0, // milliseconds
  )

  const sign = dateTimeParts[8]
  if (sign && !ignoreTimezone) {
    const direction = sign === '+' ? 1 : -1
    const hoursOffset = Number(dateTimeParts[9]) || 0
    const minutesOffset = Number(dateTimeParts[10]) || 0
    const offset = direction * (hoursOffset * 60 + minutesOffset)
    date.setMinutes(date.getMinutes() - offset - date.getTimezoneOffset())
  }

  return date
}

export const timeFormats = ['HH:mm', 'HH:mm:ss']

export const handleTZ = (val: any) => {
  if (val === undefined || val === null) {
    return
  }
  if (typeof val !== 'string') {
    return val
  }
  return val.replace(
    /((?:-?(?:[1-9][0-9]*)?[0-9]{4})-(?:1[0-2]|0[1-9])-(?:3[01]|0[1-9]|[12][0-9])T(?:2[0-3]|[01][0-9]):(?:[0-5][0-9]):(?:[0-5][0-9])(?:\.[0-9]+)?(?:Z|[+-](?:2[0-3]|[01][0-9]):[0-5][0-9]))/g,
    (i, v) => {
      return dayjs(v).format('YYYY-MM-DD HH:mm')
    },
  )
}

export function validateDateFormat(v: string) {
  return dateFormats.includes(v)
}

export function validateDateWithUnknownFormat(v: string) {
  for (const format of dateFormats) {
    if (dayjs(v, format, true).isValid() as any) {
      return true
    }
    for (const timeFormat of ['HH:mm', 'HH:mm:ss', 'HH:mm:ss.SSS']) {
      if (dayjs(v, `${format} ${timeFormat}`, true).isValid() as any) {
        return true
      }
    }
  }
  return false
}

export function getDateFormat(v: string) {
  for (const format of dateFormats) {
    if (dayjs(v, format, true).isValid()) {
      return format
    }
  }
  return 'YYYY/MM/DD'
}

export function getDateTimeFormat(v: string) {
  for (const format of dateFormats) {
    for (const timeFormat of timeFormats) {
      const dateTimeFormat = `${format} ${timeFormat}`
      if (dayjs(v, dateTimeFormat, true).isValid() as any) {
        return dateTimeFormat
      }
    }
  }
  return 'YYYY/MM/DD'
}

export function parseStringDate(v: string, dateFormat: string) {
  const dayjsObj = dayjs(v)
  if (dayjsObj.isValid()) {
    v = dayjsObj.format('YYYY-MM-DD')
  } else {
    v = dayjs(v, dateFormat).format('YYYY-MM-DD')
  }
  return v
}
