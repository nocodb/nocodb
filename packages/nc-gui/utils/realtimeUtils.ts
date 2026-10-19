import { EventType, UITypes, isLinksOrLTAR } from 'nocodb-sdk'
import type { FilterType, InterfaceFilterNode, LinkToAnotherRecordType, LookupType, RollupType, TableType } from 'nocodb-sdk'
import { interfaceDataEventSuffix } from '~/lib/interfaceData'

const COMPUTED_DISPLAY_VALUE_TYPES = new Set<UITypes>([UITypes.Formula, UITypes.Lookup, UITypes.Rollup])

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
 * its own table, or one it reaches through links (lookups, rollups and link display values
 * read it). Links are followed past the first hop only when a lookup or rollup goes through
 * them; linked metas come from the metas cache, and an uncached one counts as a match.
 * Events without a `tableId` apply to every view.
 */
export function isTableEventForMeta(
  payload: { tableId?: string } | undefined,
  meta?: TableType | null,
  metas?: Record<string, TableType | undefined>,
): boolean {
  if (!payload?.tableId || !meta?.id) return true

  const targetId = payload.tableId
  const visited = new Set<string>()

  const reaches = (table: TableType): boolean => {
    if (table.id === targetId) return true
    visited.add(table.id!)

    const columns = table.columns ?? []
    // Link columns some lookup or rollup reads through.
    const relationIds = new Set<string>()
    for (const col of columns) {
      if (col.uidt === UITypes.Lookup || col.uidt === UITypes.Rollup) {
        const relationId = (col.colOptions as LookupType | RollupType | undefined)?.fk_relation_column_id
        if (relationId) relationIds.add(relationId)
      }
    }

    for (const col of columns) {
      if (!isLinksOrLTAR(col)) continue
      const options = col.colOptions as LinkToAnotherRecordType | undefined
      const relatedId = options?.fk_related_model_id
      if (!relatedId) continue
      if (relatedId === targetId) return true
      if (visited.has(relatedId)) continue

      const related = metas?.[`${options?.fk_related_base_id || table.base_id}:${relatedId}`]

      if (relationIds.has(col.id!)) {
        if (!related?.columns || reaches(related)) return true
        continue
      }

      // A plain link still shows the related record's display value, which can be
      // computed (e.g. a formula over a lookup) and so read further tables.
      const displayValue = related?.columns?.find((c) => c.pv)
      if (displayValue && COMPUTED_DISPLAY_VALUE_TYPES.has(displayValue.uidt as UITypes) && reaches(related!)) return true
    }

    return false
  }

  return reaches(meta)
}

// Realtime payloads carry the whole view-column row, so compare values, not key presence.
export function isGroupByChanged(col: Record<string, any>, payload: Record<string, any>) {
  if (!col.group_by && !payload.group_by) return false

  const normalize = (key: string, value: unknown) => {
    if (key === 'group_by') return !!value
    if (key === 'group_by_enabled') return value !== false && value !== 0
    if (key === 'group_by_sort') return value || 'asc'
    return value ?? null
  }

  return ['group_by', 'group_by_sort', 'group_by_order', 'group_by_enabled'].some(
    (key) => key in payload && normalize(key, payload[key]) !== normalize(key, col[key]),
  )
}

export type ViewMembership = 'in' | 'out' | 'unknown'

export function viewMembership(matchedViewIds: string[] | undefined, viewId: string | undefined): ViewMembership {
  if (!viewId || !Array.isArray(matchedViewIds)) return 'unknown'
  return matchedViewIds.includes(viewId) ? 'in' : 'out'
}

/**
 * What a grid does with a peer's update to a row it hasn't loaded: `ignore` it, reload only the
 * group header aggregations (`aggregates`: the row stayed in its group), or `refresh` in place
 * because the view's or a group's rows changed. A row that starts matching is refreshed rather
 * than inserted: the update carries no order value, so a local insert can only append it.
 */
export function classifyUnloadedRowUpdate({
  wasIn,
  isIn,
  changedFields,
  groupByTitles,
}: {
  wasIn: ViewMembership
  isIn: ViewMembership
  changedFields?: string[]
  groupByTitles: string[]
}): 'ignore' | 'aggregates' | 'refresh' {
  const isGrouped = groupByTitles.length > 0

  if (wasIn === 'out' && isIn === 'out') return 'ignore'

  if (wasIn === 'in' && isIn === 'in') {
    if (!isGrouped) return 'ignore'
    if (changedFields && !groupByTitles.some((title) => changedFields.includes(title))) return 'aggregates'
    return 'refresh'
  }

  // Without both images a flat grid keeps its count: refreshing on every such event costs more than a stale count.
  if (!isGrouped) {
    if (wasIn !== isIn && wasIn !== 'unknown' && isIn !== 'unknown') return 'refresh'
    return 'ignore'
  }

  return 'refresh'
}
