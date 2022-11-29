import { UITypes } from 'nocodb-sdk'

export default
function convertCellData(args: { from: UITypes; to: UITypes; value: any }) {
  const { from, to, value } = args
  if (from === to) {
    return value
  }

  switch (to) {
    case UITypes.Number:
      return Number(value)
    case UITypes.Checkbox:
      return Boolean(value)
    case UITypes.Date:
      return new Date(value)
    case UITypes.Attachment:
      try {
        return typeof value === 'string' ? JSON.parse(value) : value
      } catch (e) {
        return []
      }
    case UITypes.LinkToAnotherRecord:
    case UITypes.Lookup:
    case UITypes.Rollup:
    case UITypes.Formula:
      throw new Error(`Unsupported conversion from ${from} to ${to}`)
    default:
      return value
  }
}
