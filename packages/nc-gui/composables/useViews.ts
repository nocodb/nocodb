import type { TableInfoType, TableType, ViewType } from 'nocodb-sdk'
import type { MaybeRef } from '@vueuse/core'
import { ref, unref, useNuxtApp, useViewsStore, watch } from '#imports'

// DEPRECATED: Use useViewsStore instead
function useViews(_: MaybeRef<TableType | TableInfoType | undefined>) {
  const { isViewsLoading, views } = storeToRefs(useViewsStore())
  const { loadViews } = useViewsStore()

  const isLoading = computed(() => isViewsLoading.value)

  return { views, isLoading, loadViews }
}

export default useViews
