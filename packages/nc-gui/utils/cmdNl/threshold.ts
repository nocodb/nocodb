import type { FilterType } from 'nocodb-sdk'
import type { CondLeaf } from './ir'

/** The two reads a percentile bound needs; the palette scopes both to the view's records. */
export interface CmdNlThresholdApi {
  count: (filters: FilterType[]) => Promise<number>
  /** The field's value in the one record at `offset` when sorted by it. */
  valueAt: (filters: FilterType[], dir: 'asc' | 'desc', offset: number) => Promise<unknown>
}

/**
 * A percentile leaf's number, on any dialect: count the non-empty values, then read one record at the
 * nearest rank, from the top for ≥ and the bottom for ≤. Null when the field has no values.
 */
export async function cmdNlThreshold(leaf: CondLeaf, p: number, api: CmdNlThresholdApi): Promise<number | null> {
  const filters = [{ fk_column_id: leaf.field.id, comparison_op: 'notblank', logical_op: 'and' } as FilterType]
  const count = await api.count(filters)
  if (!count) return null
  const desc = leaf.cmp !== 'lte'
  const rank = desc ? Math.floor(count * (1 - p)) : Math.ceil(count * p) - 1
  const raw = await api.valueAt(filters, desc ? 'desc' : 'asc', Math.min(count - 1, Math.max(0, rank)))
  const value = raw === null || raw === undefined || raw === '' ? NaN : Number(raw)
  return Number.isFinite(value) ? value : null
}
