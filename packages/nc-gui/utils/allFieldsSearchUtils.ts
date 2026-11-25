import type { ColumnType } from 'nocodb-sdk'

// All-fields search is EE; ee/utils/allFieldsSearchUtils.ts shadows these.
// Use them auto-imported: an explicit import resolves to this stub even in EE
// (Nuxt localLayerAliases). Enforced by no-restricted-imports in .eslintrc.js
// and a grep in .github/workflows/quick-checks.yml.

/** `search.field` value meaning "every visible field" (server-side all-fields search). */
export const ALL_FIELDS_SEARCH_FIELD = '__nc_all_fields__'

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

export function valueMatchesSearchTerm(
  _column: Pick<ColumnType, 'uidt' | 'dt' | 'meta' | 'colOptions'>,
  _value: unknown,
  _search: string | ParsedSearchTerm,
  _searcherTimezone?: string,
): boolean {
  return false
}

export function cellMatchesSearch(
  _highlight: ParsedSearchTerm | null | undefined,
  _column: ColumnType | undefined,
  _value: unknown,
): boolean {
  return false
}
