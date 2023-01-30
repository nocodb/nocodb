import { UITypes } from 'nocodb-sdk'

export const getSortDirectionOptions = (uidt: UITypes | string) => {
  switch (uidt) {
    case UITypes.Year:
    case UITypes.Number:
    case UITypes.Decimal:
    case UITypes.Rating:
    case UITypes.Count:
    case UITypes.AutoNumber:
    case UITypes.Time:
    case UITypes.Currency:
    case UITypes.Percent:
    case UITypes.Duration:
    case UITypes.PhoneNumber:
    case UITypes.Date:
    case UITypes.DateTime:
    case UITypes.CreateTime:
    case UITypes.LastModifiedTime:
      return [
        { text: '1 → 9', value: 'asc' },
        { text: '9 → 1', value: 'desc' },
      ]
    case UITypes.Checkbox:
      return [
        { text: '▢ → ✓', value: 'asc' },
        { text: '✓ → ▢', value: 'desc' },
      ]
    default:
      return [
        { text: 'A → Z', value: 'asc' },
        { text: 'Z → A', value: 'desc' },
      ]
  }
}
