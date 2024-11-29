import { type ColumnType, type SortType, UITypes } from 'nocodb-sdk'
import dayjs from 'dayjs'

export const getSortDirectionOptions = (uidt: UITypes | string, isGroupBy?: boolean) => {
  const groupByOptions = isGroupBy
    ? [
        { text: 'Count (9 → 1)', value: 'count-desc' },
        { text: 'Count (1 → 9)', value: 'count-asc' },
      ]
    : []

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
    case UITypes.CreatedTime:
    case UITypes.LastModifiedTime:
      return [
        { text: '1 → 9', value: 'asc' },
        { text: '9 → 1', value: 'desc' },
      ].concat(groupByOptions)
    case UITypes.Checkbox:
      return [
        { text: '▢ → ✓', value: 'asc' },
        { text: '✓ → ▢', value: 'desc' },
      ].concat(groupByOptions)
    default:
      return [
        { text: 'A → Z', value: 'asc' },
        { text: 'Z → A', value: 'desc' },
      ].concat(groupByOptions)
  }
}

export const sortByUIType = ({
  uidt,
  a,
  b,
  options: { caseSensitive = true, direction },
}: {
  uidt: UITypes
  a: any
  b: any
  options: {
    caseSensitive?: boolean
    direction?: 'asc' | 'desc' | 'count-asc' | 'count-desc'
  }
}) => {
  let nullsLast = direction !== 'asc'

  if ([UITypes.Formula, UITypes.User].includes(uidt)) {
    nullsLast = !nullsLast
  }

  if (a === null || a === undefined) {
    return nullsLast ? 1 : -1
  }
  if (b === null || b === undefined) {
    return nullsLast ? -1 : 1
  }

  if (a === '' && b !== '') return nullsLast ? 1 : -1
  if (b === '' && a !== '') return nullsLast ? -1 : 1

  let result = 0

  switch (uidt) {
    case UITypes.Number:
    case UITypes.Decimal:
    case UITypes.Currency:
    case UITypes.Percent:
    case UITypes.Rating:
    case UITypes.Duration:
    case UITypes.ID:
    case UITypes.Rollup:
      result = Number(a) - Number(b)
      break

    case UITypes.Links: {
      const getLinksValue = (links: any) => {
        if (links === null) return null

        if (typeof links === 'number') return links

        if (links && typeof links === 'object') {
          return Object.values(links)[0]
        }
        return links
      }

      const valA = getLinksValue(a)
      const valB = getLinksValue(b)

      if (typeof valA === 'number' && typeof valB === 'number') {
        result = valA - valB
      } else {
        result = String(valA).localeCompare(String(valB))
      }
      break
    }

    case UITypes.DateTime:
    case UITypes.CreatedTime:
    case UITypes.LastModifiedTime:
      result = dayjs(a).valueOf() - dayjs(b).valueOf()
      break
    case UITypes.Time: {
      const normalizeTimeValue = (value: any): dayjs.Dayjs => {
        // If it's already a dayjs object
        if (dayjs.isDayjs(value)) {
          return dayjs(`1999-01-01 ${value.format('HH:mm:ss')}`)
        }

        // If it's a string in HH:mm:ss format (from server)
        if (typeof value === 'string' && /^\d{2}:\d{2}:\d{2}$/.test(value)) {
          return dayjs(`1999-01-01 ${value}`)
        }

        // If it's a string in HH:mm format (from local state)
        if (typeof value === 'string' && /^\d{2}:\d{2}$/.test(value)) {
          return dayjs(`1999-01-01 ${value}:00`)
        }

        // For any other format, try parsing with dayjs
        let parsed = dayjs(value)

        // If not valid, try parsing as time only
        if (!parsed.isValid()) {
          parsed = dayjs(value, 'HH:mm:ss')
        }

        // If still not valid, try with dummy date
        if (!parsed.isValid()) {
          parsed = dayjs(`1999-01-01 ${value}`)
        }

        return parsed
      }

      const timeA = normalizeTimeValue(a)
      const timeB = normalizeTimeValue(b)
      result = timeA.valueOf() - timeB.valueOf()
      break
    }

    case UITypes.Year:
      result = Number(a) - Number(b)
      break

    case UITypes.Checkbox:
      result = a === b ? 0 : a ? -1 : 1
      break
    case UITypes.SingleSelect:
    case UITypes.MultiSelect:
      result = String(a).localeCompare(String(b))
      break
    case UITypes.Attachment: {
      const getAttachmentValue = (att) => {
        if (Array.isArray(att) && att.length > 0) {
          return att[0].title || att[0].path || ''
        }
        return ''
      }
      result = getAttachmentValue(a).localeCompare(getAttachmentValue(b))
      break
    }
    case UITypes.User:
    case UITypes.CreatedBy:
    case UITypes.LastModifiedBy: {
      const getUserValue = (user) => {
        if (Array.isArray(user) && user.length > 0) {
          return user[0].display_name || user[0].email || ''
        }
        if (user && typeof user === 'object') {
          return user.display_name || user.email || ''
        }
        return String(user)
      }
      result = getUserValue(a).localeCompare(getUserValue(b))
      break
    }

    case UITypes.SingleLineText:
    case UITypes.LongText:
    case UITypes.Email:
    case UITypes.URL:
    case UITypes.PhoneNumber:
    case UITypes.Formula:
      if (caseSensitive) {
        result = String(a).localeCompare(String(b))
      } else {
        result = String(a).toLowerCase().localeCompare(String(b).toLowerCase())
      }
      break

    case UITypes.JSON:
      result = JSON.stringify(a).localeCompare(JSON.stringify(b))
      break

    default:
      result = String(a).localeCompare(String(b))
  }

  return direction === 'desc' ? -result : result
}

export const isSortRelevantChange = (
  changedFields: string[],
  sorts: SortType[],
  columnsById: Record<string, ColumnType>,
): boolean => {
  const sortColumnTitles = new Set(sorts.map((sort) => columnsById[sort.fk_column_id!]?.title).filter(Boolean))

  return changedFields.some((field) => sortColumnTitles.has(field))
}
