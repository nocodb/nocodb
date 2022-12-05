import dayjs from 'dayjs'
import { UITypes } from 'nocodb-sdk'

export default function convertCellData(args: { from: UITypes; to: UITypes; value: any }, isMysql = false) {
  const { from, to, value } = args
  if (from === to && ![UITypes.Attachment, UITypes.Date, UITypes.DateTime, UITypes.Time, UITypes.Year].includes(to)) {
    return value
  }

  const dateFormat = isMysql ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD HH:mm:ssZ'

  switch (to) {
    case UITypes.Number: {
      const parsedNumber = Number(value)
      if (isNaN(parsedNumber)) {
        throw new TypeError(`Cannot convert '${value}' to number`)
      }
      return parsedNumber
    }
    case UITypes.Rating: {
      const parsedNumber = Number(value ?? 0)
      if (isNaN(parsedNumber)) {
        throw new TypeError(`Cannot convert '${value}' to rating`)
      }
      return parsedNumber
    }
    case UITypes.Checkbox:
      return Boolean(value)
    case UITypes.Date: {
      const parsedDate = dayjs(value)
      if (!parsedDate.isValid()) throw new Error('Not a valid date')
      return parsedDate.format('YYYY-MM-DD')
    }
    case UITypes.DateTime: {
      const parsedDateTime = dayjs(value)
      if (!parsedDateTime.isValid()) {
        throw new Error('Not a valid datetime value')
      }
      return parsedDateTime.format(dateFormat)
    }
    case UITypes.Time: {
      let parsedTime = dayjs(value)

      if (!parsedTime.isValid()) {
        parsedTime = dayjs(value, 'HH:mm:ss')
      }
      if (!parsedTime.isValid()) {
        parsedTime = dayjs(`1999-01-01 ${value}`)
      }
      if (!parsedTime.isValid()) {
        throw new Error('Not a valid time value')
      }
      return parsedTime.format(dateFormat)
    }
    case UITypes.Year: {
      if (/^\d+$/.test(value)) {
        return +value
      }

      const parsedDate = dayjs(value)

      if (parsedDate.isValid()) {
        return parsedDate.format('YYYY')
      }

      throw new Error('Not a valid year value')
    }
    case UITypes.Attachment: {
      let parsedVal
      try {
        parsedVal = typeof value === 'string' ? JSON.parse(value) : value
        parsedVal = Array.isArray(parsedVal) ? parsedVal : [parsedVal]
      } catch (e) {
        throw new Error('Invalid attachment data')
      }
      if (parsedVal.some((v: any) => v && !(v.url || v.data))) {
        throw new Error('Invalid attachment data')
      }
      return JSON.stringify(parsedVal)
    }
    case UITypes.LinkToAnotherRecord:
    case UITypes.Lookup:
    case UITypes.Rollup:
    case UITypes.Formula:
    case UITypes.QrCode:
      throw new Error(`Unsupported conversion from ${from} to ${to}`)
    default:
      return value
  }
}
