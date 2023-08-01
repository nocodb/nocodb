import type { TableInfoType, TableType, ViewType } from 'nocodb-sdk'
import type { MaybeRef } from '@vueuse/core'
import { ref, unref, useNuxtApp, useViewsStore, watch } from '#imports'

function useViews(meta: MaybeRef<TableType | TableInfoType | undefined>) {
  const views = ref<ViewType[]>([])
  const { isViewsLoading } = storeToRefs(useViewsStore())
  const isLoading = computed(() => isViewsLoading.value)

  const { $api } = useNuxtApp()

  const loadViews = async () => {
    const _meta = unref(meta)

    if (_meta && _meta.id) {
      isViewsLoading.value = true
      const response = (await $api.dbView.list(_meta.id)).list as ViewType[]
      if (response) {
        views.value = response.sort((a, b) => a.order! - b.order!)
      }
      isViewsLoading.value = false
    }
  }

  watch(() => unref(meta), loadViews, { immediate: true })

  return { views, isLoading, loadViews }
}

export default useViews
