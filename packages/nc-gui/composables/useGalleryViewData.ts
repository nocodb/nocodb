import type { ComputedRef, Ref } from 'vue'
import type { GalleryType, TableType, ViewType } from 'nocodb-sdk'

export function useGalleryViewData(
  _meta: Ref<TableType | undefined> | ComputedRef<TableType | undefined>,
  viewMeta: Ref<ViewType | undefined> | ComputedRef<(ViewType & { id: string }) | undefined>,
  where?: ComputedRef<string | undefined>,
) {
  const isPublic = inject(IsPublicInj, ref(false))

  const tablesStore = useTablesStore()

  const { activeTable } = storeToRefs(tablesStore)

  const { sharedView } = useSharedView()

  const meta = computed(() => _meta.value || activeTable.value)

  const viewData = computed(() => (isPublic.value ? (sharedView.value?.view as GalleryType) : viewMeta.value?.view))

  const {
    cachedRows,
    syncCount,
    clearCache,
    deleteRow,
    loadData,
    navigateToSiblingRow,
    totalRows,
    fetchChunk,
    chunkStates,
    isFirstRow,
    isLastRow,
  } = useInfiniteData({
    meta,
    viewMeta,
    callbacks: {
      getWhereFilter: async () => where?.value ?? '',
    },
    where,
    isPublic,
  })

  return {
    cachedRows,
    deleteRow,
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
  }
}
