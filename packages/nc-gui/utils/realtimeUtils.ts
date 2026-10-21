import { CURRENT_USER_TOKEN, EventType, UITypes, isLinksOrLTAR, parseProp } from 'nocodb-sdk'
import type {
  DataPayload,
  FilterType,
  InterfaceFilterNode,
  LinkToAnotherRecordType,
  LookupType,
  RollupType,
  TableType,
} from 'nocodb-sdk'
import { interfaceDataEventSuffix, isInterfaceSyntheticViewId } from '~/lib/interfaceData'

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
 * A view's membership before a peer's update. The server's list covers saved filters only, so
 * with ad-hoc client-side filters (search, URL `where`) an `in` is unknown; interface pages
 * receive synthetic view ids the server never tags, and the server never lists a view filtered
 * on the viewer (`@me`).
 */
export function previousViewMembership(
  prevMatchedViewIds: string[] | undefined,
  viewId: string | undefined,
  hasClientSideRowFilters: boolean,
  isViewerScopedView = false,
): ViewMembership {
  if (isInterfaceSyntheticViewId(viewId) || isViewerScopedView) return 'unknown'
  const membership = viewMembership(prevMatchedViewIds, viewId)
  return membership === 'in' && hasClientSideRowFilters ? 'unknown' : membership
}

/**
 * How a peer's update to a row a view hasn't loaded moves the view's row count: `none` when
 * it stayed in (or out), `add` when it entered, `remove` when it left, `unknown` without both
 * memberships.
 */
export function unloadedRowCountChange(wasIn: ViewMembership, isIn: ViewMembership): 'none' | 'add' | 'remove' | 'unknown' {
  if (wasIn === 'unknown' || isIn === 'unknown') return 'unknown'
  if (wasIn === isIn) return 'none'
  return isIn === 'in' ? 'add' : 'remove'
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
  sortTitles = [],
}: {
  wasIn: ViewMembership
  isIn: ViewMembership
  changedFields?: string[]
  groupByTitles: string[]
  sortTitles?: string[]
}): 'ignore' | 'aggregates' | 'refresh' {
  const isGrouped = groupByTitles.length > 0

  if (wasIn === 'out' && isIn === 'out') return 'ignore'

  if (wasIn === 'in' && isIn === 'in') {
    // A sorted field can move the row into (or out of) a loaded chunk.
    if (changedFields && sortTitles.some((title) => changedFields.includes(title))) return 'refresh'
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

/**
 * Whether a view's filters compare against the viewer (`@me`). The server matches rows to views
 * without a viewer, so its matched-view lists never include such a view: membership is unknown.
 */
export function hasViewerScopedFilter(filters: Array<{ value?: unknown }>): boolean {
  return filters.some((filter) => `${filter.value ?? ''}`.split(',').some((value) => value.trim() === CURRENT_USER_TOKEN))
}

const isSameMetaValue = (a: unknown, b: unknown) => {
  if ((a ?? null) === (b ?? null)) return true
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false
  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch {
    return false
  }
}

/**
 * Whether a peer's filter or sort row differs from the cached one. Only the server's keys are
 * compared (the cache adds local state such as `status` or `children`), timestamps aside.
 */
export function isMetaRowChanged(cached: Record<string, any> | undefined, next: Record<string, any>): boolean {
  if (!cached) return true
  return Object.keys(next).some((key) => key !== 'created_at' && key !== 'updated_at' && !isSameMetaValue(cached[key], next[key]))
}

const pendingPeerViewReloads = new WeakMap<object, ReturnType<typeof setTimeout>>()

/** One quiet reload per view for a burst of peer filter/sort events, however many instances hear them. */
export function schedulePeerViewReload(
  hook: { trigger: (param: { shouldShowLoading: boolean }) => unknown } | undefined,
  wait = 250,
) {
  if (!hook) return
  clearTimeout(pendingPeerViewReloads.get(hook))
  pendingPeerViewReloads.set(
    hook,
    setTimeout(() => {
      pendingPeerViewReloads.delete(hook)
      hook.trigger({ shouldShowLoading: false })
    }, wait),
  )
}

/** Whether a peer's edit to a cached RLS policy can change which rows are visible: a rename can't. */
export function isRlsPolicyEditRowAffecting(prev: Record<string, any> | undefined, next: Record<string, any>): boolean {
  if (!prev) return true
  const { title: _prevTitle, ...prevRest } = prev
  const { title: _nextTitle, ...nextRest } = next
  return isMetaRowChanged(prevRest, nextRest)
}

/**
 * Whether a peer's `table_update` changes what views of the table render from (fields, table
 * meta, sync state), so the cached meta must be replaced rather than patched. A key the payload
 * omits counts as unchanged.
 */
export function isTableStructureChanged(cached: Record<string, any>, next: Record<string, any>): boolean {
  return (['columns', 'meta', 'synced'] as const).some((key) => {
    if (!(key in next)) return false
    if (key === 'meta') return !isSameMetaValue(parseProp(cached.meta), parseProp(next.meta))
    return !isSameMetaValue(cached[key], next[key])
  })
}

export type ViewColumnState = Record<string, any> & { show?: boolean | number; group_by?: boolean | number }

/**
 * Whether a peer's view-column change needs the view's data reloaded here: a field was shown
 * (its values weren't fetched), or the grouping changed. Hiding, resizing or reordering doesn't.
 */
export function viewColumnsNeedReload(before: Record<string, ViewColumnState>, after: Record<string, ViewColumnState>): boolean {
  const ids = new Set([...Object.keys(before), ...Object.keys(after)])

  for (const id of ids) {
    const prev = before[id] ?? {}
    const next = after[id] ?? {}
    if (next.show && !prev.show) return true
    if (isGroupByChanged(prev, { group_by: false, ...next })) return true
  }

  return false
}

/**
 * Whether a peer's update can change figures a view derives from `fieldTitles` across its rows
 * (calendar active dates, timeline summaries): not for a row outside the view before and after,
 * nor for one that stayed in it without any of those fields changing.
 */
export function isRowUpdateRelevant({
  wasIn,
  isIn,
  changedFields,
  fieldTitles,
}: {
  wasIn: ViewMembership
  isIn: ViewMembership
  changedFields?: string[]
  fieldTitles: string[]
}): boolean {
  if (wasIn === 'out' && isIn === 'out') return false
  if (wasIn !== isIn || wasIn === 'unknown' || !changedFields) return true
  return fieldTitles.some((title) => changedFields.includes(title))
}

/**
 * A peer's update to a leaf row of a nested (self-link) list: `skip` it when it didn't touch
 * the view, `patch` the cached row when none of the fields placing it in the tree changed, and
 * `reload` the tree otherwise.
 */
export function classifyNestedLeafUpdate({
  wasIn,
  isIn,
  isCached,
  changedFields,
  positionTitles,
}: {
  wasIn: ViewMembership
  isIn: ViewMembership
  isCached: boolean
  changedFields?: string[]
  positionTitles: Set<string>
}): 'skip' | 'patch' | 'reload' {
  if (isIn === 'out') return wasIn === 'out' ? 'skip' : 'reload'
  if (!changedFields || changedFields.some((title) => positionTitles.has(title))) return 'reload'
  if (isCached) return 'patch'
  return wasIn === 'in' ? 'skip' : 'reload'
}

/** Every column a filter config references (`fk_column_id`, `fk_value_col_id`), at any depth. */
export function collectFilterColumnIds(node: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(node)) {
    for (const child of node) collectFilterColumnIds(child, out)
  } else if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      if ((key === 'fk_column_id' || key === 'fk_value_col_id') && typeof value === 'string') out.add(value)
      else collectFilterColumnIds(value, out)
    }
  }
  return out
}

/**
 * Whether a peer's data event can change counts taken under filters over `filterTitles`: a
 * reorder can't, nor an update whose changed fields include none of them. A filter field the
 * payload doesn't carry (projected out) may have changed unseen.
 */
export function isFilteredCountAffected(data: DataPayload, filterTitles: Set<string>): boolean {
  if (data.action === 'bulk') return (data.rows ?? []).some((row) => isFilteredCountAffected(row, filterTitles))
  if (data.action === 'reorder') return false
  if (data.action !== 'update' || !data.changedFields || !data.payload) return true
  for (const title of filterTitles) {
    if (!(title in data.payload) || data.changedFields.includes(title)) return true
  }
  return false
}

/**
 * Whether a pushed row can belong to a list the viewer narrows client-side: by `searchQuery`
 * (contains, case-insensitive, over `searchColumns`) and by `filters`. A field the payload
 * lacks, or a search value that isn't text, can't be judged here and counts as a match.
 */
export function rowMayMatchViewerScope({
  row,
  searchQuery,
  searchColumns,
  filters,
  columns,
  evaluateFilters,
}: {
  row: Record<string, any>
  searchQuery: string
  searchColumns: Array<{ title?: string | null }>
  filters: FilterType[]
  columns: Array<{ id?: string | null; title?: string | null }>
  evaluateFilters: (filters: FilterType[], row: Record<string, any>) => boolean
}): boolean {
  const query = searchQuery.trim().toLowerCase()
  const searchTitles = searchColumns.flatMap((col) => (col.title ? [col.title] : []))
  if (query && searchTitles.length) {
    const judgeable = searchTitles.every((title) => title in row && (row[title] == null || typeof row[title] === 'string'))
    if (judgeable && !searchTitles.some((title) => (row[title] ?? '').toLowerCase().includes(query))) return false
  }

  if (!filters.length) return true

  const ids = collectFilterColumnIds(filters)
  const titles = columns.flatMap((col) => (col.id && col.title && ids.has(col.id) ? [col.title] : []))
  if (titles.length < ids.size || titles.some((title) => !(title in row))) return true

  return evaluateFilters(filters, row)
}
