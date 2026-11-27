import type { ComputedRef, Ref } from 'vue'
import type { GalleryType, TableType, ViewType } from 'nocodb-sdk'

export function useGalleryViewData(
  _meta: Ref<TableType | undefined> | ComputedRef<TableType | undefined>,
  viewMeta: Ref<ViewType | undefined> | ComputedRef<(ViewType & { id: string }) | undefined>,
  where?: ComputedRef<string | undefined>,
  /** Grouped galleries: refresh the loaded groups after a peer's change. */
  refreshGroups?: () => void,
  patchGroupedRow?: (id: string, payload: Record<string, any>) => boolean,
) {
  const isPublic = inject(IsPublicInj, ref(false))

  const tablesStore = useTablesStore()

  const { activeTable } = storeToRefs(tablesStore)

  const { sharedView } = useSharedView()

  const meta = computed(() => _meta.value || activeTable.value)

  // A peer's bulk edit arrives as one event per row.
  const refreshGroupsDebounced = refreshGroups ? useDebounceFn(refreshGroups, 300) : undefined

  const viewData = computed(() => (isPublic.value ? (sharedView.value?.view as GalleryType) : viewMeta.value?.view))

  const {
    cachedRows,
    syncCount,
    clearCache,
    deleteRow,
    deleteRowById,
    insertRow,
    loadData,
    navigateToSiblingRow,
    totalRows,
    fetchChunk,
    chunkStates,
    isFirstRow,
    isLastRow,
    updateOrSaveRow,
    updateRecordOrder,
  } = useInfiniteData({
    meta,
    viewMeta,
    callbacks: {
      getWhereFilter: async () => where?.value ?? '',
      refreshInPlace: refreshGroupsDebounced,
      refreshGroupAggregations: refreshGroupsDebounced,
      patchUnloadedRow: patchGroupedRow,
    },
    where,
    isPublic,
  })

  return {
    cachedRows,
    deleteRow,
    deleteRowById,
    insertRow,
    loadData,
    navigateToSiblingRow,
    viewData,
    totalRows,
    clearCache,
    chunkStates,
    syncCount,
    fetchChunk,
    isFirstRow,
    isLastRow,
    updateOrSaveRow,
    updateRecordOrder,
  }
}
