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

export const fieldMatchesSearch = (col: ColumnType, normalizedQuery: string, row: Record<string, any> | undefined): boolean => {
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
