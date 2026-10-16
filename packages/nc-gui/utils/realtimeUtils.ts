import { EventType, isLinksOrLTAR } from 'nocodb-sdk'
import type { ColumnType, FilterType, InterfaceFilterNode, LinkToAnotherRecordType, TableType } from 'nocodb-sdk'
import { interfaceDataEventSuffix } from '~/lib/interfaceData'

/**
 * The full DATA_EVENT subscription key for a table — plain on the data tab
 * (views), page-scoped under an interface page (the api's realtime scope
 * appends the `:iface:...` segments). One builder so the key grammar lives
 * in a single place instead of per-store template literals.
 */
export function dataEventSubscriptionKey(
  meta: { fk_workspace_id?: string | null; base_id?: string | null; id?: string | null },
  interfaceApi?: { realtimeScope(): { pageId: string; vizId: string; env: string } | null } | null,
): string {
  return `${EventType.DATA_EVENT}:${meta.fk_workspace_id}:${meta.base_id}:${meta.id}${interfaceDataEventSuffix(interfaceApi)}`
}

/**
 * Client port of the server's `flattenFiltersForEval`
 * (`ee/socket/filterEvalHelpers.ts`): `validateRowFilters` → `buildFilterTree`
 * rebuilds nesting from FLAT `id`/`fk_parent_id` lists and WIPES pre-nested
 * `children`, so composed trees (user-filter selections, ad-hoc groups) must
 * be flattened with synthetic ids before evaluation or their group nodes
 * evaluate empty and pushed rows get silently dropped.
 */
export function flattenFiltersForEval(roots: Array<FilterType | InterfaceFilterNode>): FilterType[] {
  const out: FilterType[] = []
  let seq = 0
  const walk = (node: any, parentId: string | null) => {
    const id = `rt-flt-${++seq}`
    const { children, ...rest } = node ?? {}
    out.push({ ...rest, id, fk_parent_id: parentId } as FilterType)
    for (const child of children ?? []) walk(child, id)
  }
  for (const r of roots) walk(r, null)
  return out
}

/**
 * Whether a table-scoped smartsheet event (`{ tableId }` payload) concerns a view of `meta`:
 * its own table, or one it links to (lookups, rollups and link display values read it).
 * Events without a `tableId` apply to every view.
 */
export function isTableEventForMeta(payload: { tableId?: string } | undefined, meta?: TableType | null): boolean {
  if (!payload?.tableId || !meta?.id) return true
  if (payload.tableId === meta.id) return true

  return !!meta.columns?.some(
    (col: ColumnType) =>
      isLinksOrLTAR(col) && (col.colOptions as LinkToAnotherRecordType | undefined)?.fk_related_model_id === payload.tableId,
  )
}
