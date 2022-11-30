import { UITypes } from 'nocodb-sdk'

export default function convertCellData(args: { from: UITypes; to: UITypes; value: any }) {
  const { from, to, value } = args
  if (from === to && from !== UITypes.Attachment) {
    return value
  }

  switch (to) {
    case UITypes.Number:
      return Number(value)
    case UITypes.Checkbox:
      return Boolean(value)
    case UITypes.Date:
      return new Date(value)
    case UITypes.Attachment: {
      let parsedVal;
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
