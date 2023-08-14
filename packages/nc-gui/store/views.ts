import type { ViewType } from 'nocodb-sdk'
import { acceptHMRUpdate, defineStore } from 'pinia'

export const useViewsStore = defineStore('viewsStore', () => {
  const { $api } = useNuxtApp()

  const router = useRouter()
  const route = router.currentRoute

  const views = ref<ViewType[]>([])
  const isViewsLoading = ref(true)
  const isViewDataLoading = ref(true)
  const isPublic = computed(() => route.value.meta?.public)

  const { activeTable } = storeToRefs(useTablesStore())

  const activeViewTitle = computed(() => {
    if (!route.value.params.viewTitle?.length) return views.value.length ? views.value[0].title : undefined

    return route.value.params.viewTitle
  })

  const openedViewsTab = computed(() => {
    if (route.value.query.page === 'webhooks') {
      return 'webhooks'
    }

    if (route.value.query.page === 'apis') {
      return 'apis'
    }

    return 'views'
  })

  const { sharedView } = useSharedView()

  const activeView = computed<ViewType | undefined>({
    get() {
      if (sharedView.value) return sharedView.value

      if (!activeTable.value) return undefined

      if (!activeViewTitle.value) return undefined

      return views.value.find((v) => v.title === activeViewTitle.value)
    },
    set(_view: ViewType | undefined) {
      if (sharedView.value) {
        sharedView.value = _view
        return
      }

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

  const onViewsTabChange = (page: 'views' | 'webhooks' | 'apis') => {
    router.push({
      query: {
        ...route.value.query,
        page: page === 'views' ? undefined : page,
      },
    })
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
    openedViewsTab,
    onViewsTabChange,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useViewsStore as any, import.meta.hot))
}
