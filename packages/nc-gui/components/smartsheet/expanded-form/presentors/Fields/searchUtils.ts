import type { ColumnType } from 'nocodb-sdk'

const stringifyValue = (value: unknown): string => {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value) || typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

/**
 * Match a column against the field-filters search query.
 *
 * Tries the column title first, then the stringified raw row value. Matches
 * against RAW stored values, not formatted display values — searching for
 * "Jun" against a date stored as `2026-06-15` or "$1,299" against a currency
 * stored as `1299.99` will not match. Per-cell formatting is expensive and
 * locale-dependent, so the trade-off is intentional.
 *
 * Normalization (trim + lowercase) is done inside the function so callers
 * can pass the raw input safely. Callers that pre-normalize (e.g. in a
 * `computed`) pay no real cost — the second normalization is a no-op on
 * already-clean strings.
 */
export const fieldMatchesSearch = (col: ColumnType, query: string, row: Record<string, any> | undefined): boolean => {
  const normalizedQuery = (query ?? '').trim().toLowerCase()
  if (!normalizedQuery) return true

  if ((col.title || '').toLowerCase().includes(normalizedQuery)) return true

  const raw = col.title ? row?.[col.title] : undefined
  if (raw == null) return false

  return stringifyValue(raw).toLowerCase().includes(normalizedQuery)
}

export const isBlankFieldValue = (value: unknown): boolean => {
  if (value == null) return true
  if (typeof value === 'string') return value.trim() === ''
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'object') return Object.keys(value as Record<string, unknown>).length === 0
  return false
}
