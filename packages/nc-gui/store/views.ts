import type { ViewType } from 'nocodb-sdk'
import { acceptHMRUpdate, defineStore } from 'pinia'

export const useViewsStore = defineStore('viewsStore', () => {
  const { $api } = useNuxtApp()

  const route = useRoute()

  const views = ref<ViewType[]>([])
  const isViewsLoading = ref(true)
  const isViewDataLoading = ref(true)
  const isPublic = computed(() => route.meta?.public)

  const { activeTable } = storeToRefs(useTablesStore())

  const activeViewTitle = computed(() => {
    if (!route.params.viewTitle?.length) return views.value.length ? views.value[0].title : undefined

    return route.params.viewTitle
  })

  const activeView = computed<ViewType | undefined>({
    get() {
      if (!activeTable.value) return undefined

      if (!activeViewTitle.value) return undefined

      return views.value.find((v) => v.title === activeViewTitle.value)
    },
    set(_view: ViewType | undefined) {
      if (!activeTable.value) return
      if (!_view) return

      const viewIndex = views.value.findIndex((v) => v.title === activeViewTitle.value)
      if (viewIndex === -1) return

      views.value[viewIndex] = _view
    },
  })

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
      if (isPublic.value) {
        isViewsLoading.value = false
        return
      }

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
    activeView,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useViewsStore as any, import.meta.hot))
}
