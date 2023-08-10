import type { TableReqType, TableType } from 'nocodb-sdk'
import type { MaybeRef } from '@vueuse/core'
import { useViewsStore } from '#imports'

// DEPRECATED: Use useViewsStore instead
function useViews(_: MaybeRef<TableType | TableReqType | undefined>) {
  const { isViewsLoading, views } = storeToRefs(useViewsStore())
  const { loadViews } = useViewsStore()

  const isLoading = computed(() => isViewsLoading.value)

  return { views, isLoading, loadViews }
}

export default useViews
