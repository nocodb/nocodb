import { FormulaDataTypes, UITypes, getMetaWithCompositeKey, isSingleRecordLinkColumn, ncIsNaN } from 'nocodb-sdk'
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
  // tables already passed through via a link: reaching one again as a link is a cycle
  const visited = new Set<string>()

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

    const hereKey = `${currentMeta?.base_id}:${currentMeta?.id}`
    const next = Array.isArray(value) ? value[0] : value
    // unlinked: nothing to show, but the chain itself is intact
    if (next === null || next === undefined) {
      return { text: '', leafColumn: col, leafValue: null, leafMeta: currentMeta, complete: true }
    }

    const colOptions = col.colOptions as LinkToAnotherRecordType
    const relatedBaseId = colOptions.fk_related_base_id || currentMeta?.base_id
    const relatedModelId = colOptions.fk_related_model_id as string
    const relatedKey = `${relatedBaseId}:${relatedModelId}`

    if (depth + 1 > LINKED_RECORD_MAX_DEPTH || visited.has(hereKey)) return incomplete()
    if (typeof next !== 'object') return incomplete()

    const relatedMeta = getMetaWithCompositeKey(opts.metas, relatedBaseId, relatedModelId)
    if (!relatedMeta) return incomplete({ missingMeta: { tableId: relatedModelId, baseId: relatedBaseId } })

    visited.add(hereKey)
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
  const seen = new Set<string>()

  for (let depth = 0; ; depth++) {
    const col = pickDisplayColumn(currentMeta, overrideId)
    if (!col) return { complete: false }
    if (!isSingleRecordLinkColumn(col)) return { column: col, meta: currentMeta, complete: true }

    const opts = col.colOptions as LinkToAnotherRecordType
    const baseId = opts.fk_related_base_id || currentMeta?.base_id
    const tableId = opts.fk_related_model_id as string
    const key = `${currentMeta?.base_id}:${currentMeta?.id}`
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

// Leaf column of a link's display chain from already-loaded metas; undefined when a hop is missing
function resolveLeafColumnSync(col: ColumnType, hostMeta?: TableType, metas?: Record<string, TableType>): ColumnType | undefined {
  let current: ColumnType | undefined = col
  let currentMeta = hostMeta
  const seen = new Set<string>()
  for (let depth = 0; depth <= LINKED_RECORD_MAX_DEPTH * 2; depth++) {
    if (!current) return undefined
    const opts = current.colOptions as any
    let related: TableType | undefined
    let next: (meta?: TableType) => ColumnType | undefined
    if (isSingleRecordLinkColumn(current)) {
      const baseId = opts.fk_related_base_id || currentMeta?.base_id
      related = getMetaWithCompositeKey(metas, baseId, opts.fk_related_model_id as string)
      next = (m) => pickDisplayColumn(m, opts.fk_display_value_column_id)
      if (seen.has(`${baseId}:${opts.fk_related_model_id}`)) return undefined
      seen.add(`${baseId}:${opts.fk_related_model_id}`)
    } else if (current.uidt === UITypes.Lookup) {
      const rel = currentMeta?.columns?.find((c) => c.id === opts.fk_relation_column_id)
      const relOpts = rel?.colOptions as LinkToAnotherRecordType | undefined
      if (!relOpts) return undefined
      related = getMetaWithCompositeKey(
        metas,
        relOpts.fk_related_base_id || currentMeta?.base_id,
        relOpts.fk_related_model_id as string,
      )
      next = (m) => m?.columns?.find((c) => c.id === opts.fk_lookup_column_id)
    } else return current
    if (!related) return undefined
    current = next(related)
    currentMeta = related
  }
  return undefined
}

const TEXT_LEAF = new Set<string>([UITypes.SingleLineText, UITypes.LongText, UITypes.Email, UITypes.URL, UITypes.PhoneNumber])
const NUMERIC_LEAF = new Set<string>([
  UITypes.Number,
  UITypes.Decimal,
  UITypes.Currency,
  UITypes.Percent,
  UITypes.Duration,
  UITypes.AutoNumber,
])

// Search clause on a single-record link column: the server resolves the op on it to the leaf display column.
// undefined: not a link; '': a link whose leaf cannot be searched with this query. With no metas the leaf
// is unknown and `like` is assumed.
export function linkDisplaySearchClause(
  col: ColumnType,
  query: string,
  as: 'string' | 'object' = 'string',
  ctx?: { meta?: TableType; metas?: Record<string, TableType> },
): string | { fk_column_id: string; comparison_op: 'like' | 'eq'; value: string } | undefined {
  const value = query?.trim()
  if (!value || !isSingleRecordLinkColumn(col)) return undefined

  let op: 'like' | 'eq' = 'like'
  const leaf = ctx ? resolveLeafColumnSync(col, ctx.meta, ctx.metas) : undefined
  if (leaf) {
    const dataType = (leaf.colOptions as any)?.parsed_tree?.dataType
    if (TEXT_LEAF.has(leaf.uidt as string)) op = 'like'
    else if (NUMERIC_LEAF.has(leaf.uidt as string) || (leaf.uidt === UITypes.Formula && dataType === FormulaDataTypes.NUMERIC)) {
      if (ncIsNaN(value)) return ''
      op = 'eq'
    } else if (leaf.uidt === UITypes.Formula && (dataType === undefined || dataType === FormulaDataTypes.STRING)) {
      op = 'like'
    } else return ''
  }

  if (as === 'object') return { fk_column_id: col.id!, comparison_op: op, value }
  return op === 'like' ? `(${col.title},like,%${value}%)` : `(${col.title},eq,${value})`
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
