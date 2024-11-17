import type { TableReqType, TableType } from 'nocodb-sdk'
import type { MaybeRef } from '@vueuse/core'

// DEPRECATED: Use useViewsStore instead
function useViews(_: MaybeRef<TableType | TableReqType | undefined>) {
  const viewsStore = useViewsStore()
  const { loadViews } = viewsStore
  const { isViewsLoading, views } = storeToRefs(viewsStore)

  const isLoading = computed(() => isViewsLoading.value)

  return { views, isLoading, loadViews }
}

export default useViews
