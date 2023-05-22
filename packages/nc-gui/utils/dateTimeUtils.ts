import dayjs from 'dayjs'

export const timeAgo = (date: any) => {
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(date)) {
    // if there is no timezone info, consider as UTC
    // e.g. 2023-01-01 08:00:00 (MySQL)
    date += '+00:00'
  }
  // show in local time
  return dayjs(date).fromNow()
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
