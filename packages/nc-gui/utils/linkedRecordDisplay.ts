import { getMetaWithCompositeKey, isSingleRecordLinkColumn } from 'nocodb-sdk'
import type { ColumnType, LinkToAnotherRecordType, TableType } from 'nocodb-sdk'

// Hops followed through single-record links that are themselves a display value
export const LINKED_RECORD_MAX_DEPTH = 5

export interface LinkedRecordDisplay {
  text: string
  leafColumn?: ColumnType
  leafValue: unknown
  leafMeta?: TableType
  // false on a cycle, depth overflow or missing meta
  complete: boolean
  // set when a hop's meta is not loaded, so the caller can request it
  missingMeta?: { tableId: string; baseId?: string }
}

interface ResolveOptions {
  metas?: Record<string, TableType>
  // the link's fk_display_value_column_id
  overrideColumnId?: string | null
  format?: (value: unknown, column: ColumnType, meta?: TableType) => string
}

const defaultFormat = (value: unknown) => {
  if (value === null || value === undefined || typeof value === 'object') return ''
  return String(value)
}

const readField = (record: Record<string, any> | null | undefined, col: ColumnType) =>
  record ? record[col.title as string] ?? record[col.id as string] : undefined

// Override, then pv, then the first column (same precedence as useLTARStore)
export const pickDisplayColumn = (meta?: TableType, overrideColumnId?: string | null) =>
  (overrideColumnId ? meta?.columns?.find((c) => c.id === overrideColumnId) : undefined) ??
  meta?.columns?.find((c) => c.pv) ??
  meta?.columns?.[0]

export function resolveLinkedRecordDisplay(
  record: Record<string, any> | null | undefined,
  meta: TableType | undefined,
  opts: ResolveOptions = {},
): LinkedRecordDisplay {
  const format = opts.format ?? defaultFormat
  const visited = new Set<string>()
  if (meta) visited.add(`${meta.base_id}:${meta.id}`)

  let currentMeta = meta
  let currentRecord = record
  let overrideId = opts.overrideColumnId

  for (let depth = 0; ; depth++) {
    const col = pickDisplayColumn(currentMeta, overrideId)
    if (!col) return { text: '', leafValue: undefined, leafMeta: currentMeta, complete: false }

    const value = readField(currentRecord, col)

    if (!isSingleRecordLinkColumn(col)) {
      return { text: format(value, col, currentMeta), leafColumn: col, leafValue: value, leafMeta: currentMeta, complete: true }
    }

    const incomplete = (extra: Partial<LinkedRecordDisplay> = {}): LinkedRecordDisplay => ({
      text: '',
      leafColumn: col,
      leafValue: value,
      leafMeta: currentMeta,
      complete: false,
      ...extra,
    })

    const next = Array.isArray(value) ? value[0] : value
    // unlinked: nothing to show, but the chain itself is intact
    if (next === null || next === undefined) {
      return { text: '', leafColumn: col, leafValue: null, leafMeta: currentMeta, complete: true }
    }

    const colOptions = col.colOptions as LinkToAnotherRecordType
    const relatedBaseId = colOptions.fk_related_base_id || currentMeta?.base_id
    const relatedModelId = colOptions.fk_related_model_id as string
    const relatedKey = `${relatedBaseId}:${relatedModelId}`

    if (depth + 1 > LINKED_RECORD_MAX_DEPTH || visited.has(relatedKey)) return incomplete()
    if (typeof next !== 'object') return incomplete()

    const relatedMeta = getMetaWithCompositeKey(opts.metas, relatedBaseId, relatedModelId)
    if (!relatedMeta) return incomplete({ missingMeta: { tableId: relatedModelId, baseId: relatedBaseId } })

    visited.add(relatedKey)
    currentMeta = relatedMeta
    currentRecord = next
    overrideId = colOptions.fk_display_value_column_id
  }
}

// Display text of a record of `meta`, following a pv that is a single-record link
export const recordTitleOf = (
  row: Record<string, any> | null | undefined,
  meta: TableType | undefined,
  metas?: Record<string, TableType>,
  format?: ResolveOptions['format'],
): string => resolveLinkedRecordDisplay(row, meta, { metas, format }).text

// Follows the display column through single-record links by meta alone (no record),
// loading each hop through `loadMeta`. Returns the leaf column and its table.
export async function resolveDisplayLeafColumn(
  meta: TableType | undefined,
  loadMeta: (baseId: string, tableId: string) => Promise<TableType | undefined | null>,
  overrideColumnId?: string | null,
): Promise<{ column?: ColumnType; meta?: TableType; complete: boolean }> {
  let currentMeta = meta
  let overrideId = overrideColumnId
  const seen = new Set<string>(meta ? [`${meta.base_id}:${meta.id}`] : [])

  for (let depth = 0; ; depth++) {
    const col = pickDisplayColumn(currentMeta, overrideId)
    if (!col) return { complete: false }
    if (!isSingleRecordLinkColumn(col)) return { column: col, meta: currentMeta, complete: true }

    const opts = col.colOptions as LinkToAnotherRecordType
    const baseId = opts.fk_related_base_id || currentMeta?.base_id
    const tableId = opts.fk_related_model_id as string
    const key = `${baseId}:${tableId}`
    if (!baseId || !tableId || depth + 1 > LINKED_RECORD_MAX_DEPTH || seen.has(key)) return { complete: false }
    seen.add(key)

    let next: TableType | undefined | null
    try {
      next = await loadMeta(baseId, tableId)
    } catch {
      return { complete: false }
    }
    if (!next) return { complete: false }

    currentMeta = next
    overrideId = opts.fk_display_value_column_id
  }
}

// Search clause on a single-record link column: the server resolves `like` on it to the leaf display text
export function linkDisplaySearchClause(
  col: ColumnType,
  query: string,
  as: 'string' | 'object' = 'string',
): string | { fk_column_id: string; comparison_op: 'like'; value: string } | undefined {
  const value = query?.trim()
  if (!value || !isSingleRecordLinkColumn(col)) return undefined
  if (as === 'object') return { fk_column_id: col.id!, comparison_op: 'like', value }
  return `(${col.title},like,%${value}%)`
}

// Loads, one hop at a time, the metas a record's link display chain still lacks.
// Failures stop quietly; the title then stays empty.
export async function ensureLinkedRecordMetas(
  record: Record<string, any> | null | undefined,
  meta: TableType | undefined,
  io: {
    getMetas: () => Record<string, TableType> | undefined
    loadMeta: (baseId: string, tableId: string) => Promise<unknown>
  },
  overrideColumnId?: string | null,
): Promise<void> {
  for (let i = 0; i <= LINKED_RECORD_MAX_DEPTH; i++) {
    const { missingMeta } = resolveLinkedRecordDisplay(record, meta, { metas: io.getMetas(), overrideColumnId })
    if (!missingMeta?.baseId) return
    try {
      await io.loadMeta(missingMeta.baseId, missingMeta.tableId)
    } catch {
      return
    }
    // still absent after the load: give up instead of looping
    if (!getMetaWithCompositeKey(io.getMetas(), missingMeta.baseId, missingMeta.tableId)) return
  }
}
