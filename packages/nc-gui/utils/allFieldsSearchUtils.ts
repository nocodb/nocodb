import { type ColumnType, UITypes } from 'nocodb-sdk'

// CE matches text fields only, as its server does; ee/utils/allFieldsSearchUtils.ts shadows these.
// Use them auto-imported: an explicit import resolves to this file even in EE
// (Nuxt localLayerAliases). Enforced by no-restricted-imports in .eslintrc.js
// and a grep in .github/workflows/quick-checks.yml.

/** `search.field` value meaning "every visible field" (server-side all-fields search). */
export const ALL_FIELDS_SEARCH_FIELD = '__nc_all_fields__'

// Mirrors TEXT_SEARCH_TYPES in nocodb/src/db/search/index.ts.
const TEXT_SEARCH_TYPES = new Set<string>([
  UITypes.SingleLineText,
  UITypes.LongText,
  UITypes.Email,
  UITypes.URL,
  UITypes.PhoneNumber,
  UITypes.SingleSelect,
  UITypes.MultiSelect,
])

export interface ParsedSearchTerm {
  term: string
  timezone: string
  number?: number
  multiSelectTerm?: string
  numberText?: string
}

export function getSearchTimezone(): string | undefined {
  return undefined
}

export function parseSearchTerm(term: string, searcherTimezone = ''): ParsedSearchTerm {
  return { term, timezone: searcherTimezone }
}

// `toLowerCase` folds every Unicode letter; the server folds both sides except on
// SQLite (ASCII only) and MSSQL (the column's collation), so there a loaded row can
// highlight (`École` for `école`) where the server's count didn't match it.
export function valueMatchesSearchTerm(
  column: Pick<ColumnType, 'uidt' | 'dt' | 'meta' | 'colOptions'>,
  value: unknown,
  search: string | ParsedSearchTerm,
  _searcherTimezone?: string,
): boolean {
  if (!TEXT_SEARCH_TYPES.has(column.uidt ?? '') || value === null || value === undefined || value === '') return false
  const term = typeof search === 'string' ? search : search.term
  return String(value).toLowerCase().includes(term)
}

/** Whether an all-fields search matches `column`, e.g. the display value; CE reads text fields only. */
export function allFieldsSearchCovers(column?: Pick<ColumnType, 'uidt'>): boolean {
  return !column || TEXT_SEARCH_TYPES.has(column.uidt ?? '')
}

export function cellMatchesSearch(
  highlight: ParsedSearchTerm | null | undefined,
  column: ColumnType | undefined,
  value: unknown,
): boolean {
  if (!highlight || !column) return false
  return valueMatchesSearchTerm(column, value, highlight)
}
