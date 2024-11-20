import type { ComputedRef, Ref } from 'vue'
import type { GalleryType, TableType, ViewType } from 'nocodb-sdk'

export function useGalleryViewData(
  _meta: Ref<TableType | undefined> | ComputedRef<TableType | undefined>,
  viewMeta: Ref<ViewType | undefined> | ComputedRef<(ViewType & { id: string }) | undefined>,
  where?: ComputedRef<string | undefined>,
) {
  const isPublic = inject(IsPublicInj, ref(false))

  const { $api } = useNuxtApp()

  const tablesStore = useTablesStore()

  const { activeTable } = storeToRefs(tablesStore)

  const { sharedView } = useSharedView()

  const meta = computed(() => _meta.value || activeTable.value)

  const viewData = ref<GalleryType | undefined>()

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
    callbacks: {},
    where,
  })

  async function loadGalleryData() {
    if (!viewMeta?.value?.id) return
    viewData.value = isPublic.value ? (sharedView.value?.view as GalleryType) : await $api.dbView.galleryRead(viewMeta.value.id)
  }

  return {
    cachedRows,
    deleteRow,
    loadData,
    navigateToSiblingRow,
    loadGalleryData,
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
