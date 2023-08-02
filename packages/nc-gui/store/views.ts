import type { ViewType } from 'nocodb-sdk'
import { acceptHMRUpdate, defineStore } from 'pinia'

export const useViewsStore = defineStore('viewsStore', () => {
  const views = ref<ViewType[]>([])
  const { $api } = useNuxtApp()

  const isViewsLoading = ref(true)
  const isViewDataLoading = ref(true)

  // Used for Grid View Pagination
  const isPaginationLoading = ref(false)

  const tablesStore = useTablesStore()

  const loadViews = async () => {
    if (tablesStore.activeTableId) {
      isViewsLoading.value = true
      const response = (await $api.dbView.list(tablesStore.activeTableId)).list as ViewType[]
      if (response) {
        views.value = response.sort((a, b) => a.order! - b.order!)
      }
      isViewsLoading.value = false
    }
  }

  watch(
    () => tablesStore.activeTableId,
    async (newId, oldId) => {
      if (newId === oldId) return

      isViewsLoading.value = true
      isViewDataLoading.value = true

      try {
        await loadViews()
      } catch (e) {
        console.error(e)
      } finally {
        isViewsLoading.value = false
      }
    },
    { immediate: true },
  )

  return {
    isViewsLoading,
    isViewDataLoading,
    isPaginationLoading,
    loadViews,
    views,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useViewsStore as any, import.meta.hot))
}
