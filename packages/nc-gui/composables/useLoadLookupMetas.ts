import { UITypes } from 'nocodb-sdk'
import type { ColumnType, LinkToAnotherRecordType, LookupType, TableType } from 'nocodb-sdk'

/**
 * Preload the related-table metas referenced by a table's Lookup columns,
 * walking nested Lookup → Lookup chains down to their leaf.
 *
 * The flat PlainCell renderer used by the Gantt / Timeline / Calendar bar and
 * record labels resolves lookup display values via `getLookupValue`, which only
 * READS the `metas` cache — it never loads a missing related meta. On a fresh
 * page load (direct URL, refresh, shared link) those metas aren't warmed by any
 * prior navigation, so a lookup-of-a-lookup renders empty or as "[object
 * Object]". The canvas grid avoids this because its Lookup cell renderer loads
 * chain metas on demand; this composable does the same for the flat renderers.
 */
export function useLoadLookupMetas(metaRef: MaybeRef<TableType | undefined>, opts: { enabled?: MaybeRef<boolean> } = {}) {
  const { getMeta } = useMetas()

  // Walk a single Lookup column's chain, loading each related table's meta.
  const loadColumnChain = async (rootMeta: TableType, lookupCol: ColumnType) => {
    let ownMeta: TableType | undefined = rootMeta
    let col: ColumnType | undefined = lookupCol
    // Guard against malformed self-referential chains.
    let guard = 0

    while (col && col.uidt === UITypes.Lookup && ownMeta && guard++ < 20) {
      const lkOpt = col.colOptions as LookupType
      const relCol = ownMeta.columns?.find((c) => c.id === lkOpt.fk_relation_column_id)
      const relOpt = relCol?.colOptions as LinkToAnotherRecordType | undefined

      const relModelId: string | undefined = relOpt?.fk_related_model_id
      // fk_related_base_id covers cross-base relations; fall back to own base.
      const relBaseId: string | undefined = relOpt?.fk_related_base_id || ownMeta.base_id
      if (!relModelId || !relBaseId) break

      // getMeta returns the cached meta when present and loads + caches it
      // otherwise. disableError avoids a toast if a chain table is inaccessible.
      const relMeta: TableType | undefined = (await getMeta(relBaseId, relModelId, false, false, true)) ?? undefined
      if (!relMeta) break

      ownMeta = relMeta
      col = relMeta.columns?.find((c: ColumnType) => c.id === lkOpt.fk_lookup_column_id)
    }
  }

  const loadChainMetas = async (rootMeta?: TableType) => {
    if (!rootMeta?.columns?.length) return

    const lookupCols = rootMeta.columns.filter((c) => c.uidt === UITypes.Lookup)
    await Promise.all(lookupCols.map((c) => loadColumnChain(rootMeta, c)))
  }

  watch(
    () => unref(metaRef),
    (m) => {
      if (opts.enabled !== undefined && !unref(opts.enabled)) return
      if (m) loadChainMetas(m)
    },
    { immediate: true },
  )

  return { loadChainMetas }
}
