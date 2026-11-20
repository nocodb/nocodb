import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone.js'
import utc from 'dayjs/plugin/utc.js'
import {
  ButtonActionsType,
  type ButtonType,
  type ColumnType,
  UITypes,
  getNodejsTimezone,
  parseSearchDate,
  parseSearchNumber,
  searchDayTimezone,
  searchMatchKind,
} from 'nocodb-sdk'

dayjs.extend(utc)
dayjs.extend(timezone)

/** `search.field` value meaning "every visible field" (server-side all-fields search). */
export const ALL_FIELDS_SEARCH_FIELD = '__nc_all_fields__'

const MAX_MATCH_DEPTH = 3

/** The searcher's timezone, sent with the search so DateTime days match the grid's local display. */
export function getSearchTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

/** A lower-cased search term with its number, day and the searcher's timezone resolved once. */
export interface ParsedSearchTerm {
  term: string
  timezone: string
  number?: number
  day?: string
}

export function parseSearchTerm(term: string, searcherTimezone = getSearchTimezone()): ParsedSearchTerm {
  return { term, timezone: searcherTimezone, number: parseSearchNumber(term), day: parseSearchDate(term) }
}

/** Text match on a displayed value: contains, through linked records / users and their fields. */
function textMatches(value: unknown, term: string, depth = 0): boolean {
  if (value === null || value === undefined || value === '' || depth > MAX_MATCH_DEPTH) return false
  if (typeof value === 'string') return value.toLowerCase().includes(term)
  if (typeof value === 'number' || typeof value === 'bigint') return String(value).includes(term)
  if (Array.isArray(value)) return value.some((v) => textMatches(v, term, depth + 1))
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some((v) => textMatches(v, term, depth + 1))
  }
  return false
}

/**
 * Whether a loaded cell value matches `term` (lower-cased) the way the server's
 * all-fields search does: text contains, numbers whole, dates by day.
 */
export function valueMatchesSearchTerm(
  column: Pick<ColumnType, 'uidt' | 'dt' | 'meta' | 'colOptions'>,
  value: unknown,
  search: string | ParsedSearchTerm,
  searcherTimezone?: string,
): boolean {
  if (value === null || value === undefined || value === '') return false
  const parsed = typeof search === 'string' ? parseSearchTerm(search, searcherTimezone) : search
  const term = parsed.term

  // The index holds these as text, though the SDK's match rule skips them.
  switch (column.uidt) {
    case UITypes.JSON:
      return textMatches(typeof value === 'string' ? value : JSON.stringify(value), term)
    case UITypes.UUID:
      return textMatches(value, term)
    case UITypes.Attachment: {
      let files = value
      if (typeof files === 'string') {
        try {
          files = JSON.parse(files)
        } catch {
          return false
        }
      }
      return (
        Array.isArray(files) &&
        files.some((file) => {
          if (!file || typeof file !== 'object') return false
          const { title, fileName } = file as { title?: unknown; fileName?: unknown }
          return textMatches(title ?? fileName, term)
        })
      )
    }
    case UITypes.Button: {
      const options = column.colOptions as ButtonType | undefined
      if (options?.type !== ButtonActionsType.Url || !options.formula || options.error) return false
      return textMatches((value as { url?: unknown }).url, term)
    }
  }

  switch (searchMatchKind(column)) {
    case 'text':
      return textMatches(value, term)
    case 'number':
      return parsed.number !== undefined && Number(value) === parsed.number
    case 'date': {
      const searched = parsed.day
      if (searched === undefined || (typeof value !== 'string' && !(value instanceof Date))) return false
      const dayTimezone = searchDayTimezone(column, parsed.timezone)
      const day = dayTimezone ? dayjs(value).tz(getNodejsTimezone(dayTimezone)) : dayjs(value)
      return day.isValid() && day.format('YYYY-MM-DD') === searched
    }
    default:
      return false
  }
}

/** Whether a grid cell's loaded value matches an all-fields search (null highlight = no such search). */
export function cellMatchesSearch(
  highlight: ParsedSearchTerm | null | undefined,
  column: ColumnType | undefined,
  value: unknown,
): boolean {
  if (!highlight || !column) return false
  return valueMatchesSearchTerm(column, value, highlight)
}
