import { EventType } from 'nocodb-sdk'
import type { FilterType } from 'nocodb-sdk'
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
export function flattenFiltersForEval(roots: FilterType[]): FilterType[] {
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
