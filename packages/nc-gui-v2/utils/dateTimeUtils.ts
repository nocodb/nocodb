import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
dayjs.extend(customParseFormat)

export const timeAgo = (date: any) => {
  return dayjs.utc(date).fromNow()
}

export const dateFormats = [
  'DD-MM-YYYY',
  'MM-DD-YYYY',
  'YYYY-MM-DD',
  'DD/MM/YYYY',
  'MM/DD/YYYY',
  'YYYY/MM/DD',
  'DD MM YYYY',
  'MM DD YYYY',
  'YYYY MM DD',
]

export const handleTZ = (val: any) => {
  if (!val) {
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
  let res = 0
  for (const format of dateFormats) {
    res |= dayjs(v, format, true).isValid() as any
  }
  return res
}
