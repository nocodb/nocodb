import { type ViewType } from 'nocodb-sdk'
import { acceptHMRUpdate, defineStore } from 'pinia'
import type { ViewPageType } from '~/lib'

export const useViewsStore = defineStore('viewsStore', () => {
  const { $api } = useNuxtApp()

  const router = useRouter()
  const route = router.currentRoute

  const tablesStore = useTablesStore()

  const viewsByTable = ref<Map<string, ViewType[]>>(new Map())
  const views = computed({
    get: () => (tablesStore.activeTableId ? viewsByTable.value.get(tablesStore.activeTableId) : []) ?? [],
    set: (value) => {
      if (!tablesStore.activeTableId) return
      if (!value) return viewsByTable.value.delete(tablesStore.activeTableId)

      viewsByTable.value.set(tablesStore.activeTableId, value)
    },
  })
  const isViewsLoading = ref(true)
  const isViewDataLoading = ref(true)
  const isPublic = computed(() => route.value.meta?.public)

  const { activeTable } = storeToRefs(useTablesStore())

  const activeViewTitleOrId = computed(() => {
    if (!route.value.params.viewTitle?.length) return views.value.length ? views.value[0].id : undefined

    return route.value.params.viewTitle
  })

  // Get view page type acc to route which will be used to open the view page
  const openedViewsTab = computed<ViewPageType>(() => {
    // For types in ViewPageType type
    if (!route.value.params?.slugs || route.value.params.slugs?.length === 0) return 'view'

    if (route.value.params.slugs[0] === 'webhook') return 'webhook'
    if (route.value.params.slugs[0] === 'field') return 'field'
    if (route.value.params.slugs[0] === 'api') return 'api'
    if (route.value.params.slugs[0] === 'relation') return 'relation'

    return 'view'
  })

  const { sharedView } = useSharedView()

  const activeView = computed<ViewType | undefined>({
    get() {
      if (sharedView.value) return sharedView.value

      if (!activeTable.value) return undefined

      if (!activeViewTitleOrId.value) return undefined

      return (
        views.value.find((v) => v.id === activeViewTitleOrId.value) ??
        views.value.find((v) => v.title === activeViewTitleOrId.value)
      )
    },
    set(_view: ViewType | undefined) {
      if (sharedView.value) {
        sharedView.value = _view
        return
      }

      if (!activeTable.value) return
      if (!_view) return

      const viewIndex =
        views.value.findIndex((v) => v.id === activeViewTitleOrId.value) ??
        views.value.findIndex((v) => v.title === activeViewTitleOrId.value)
      if (viewIndex === -1) return

      views.value[viewIndex] = _view
    },
  })

  // Used for Grid View Pagination
  const isPaginationLoading = ref(true)

  const loadViews = async ({
    tableId,
    ignoreLoading,
    force,
  }: { tableId?: string; ignoreLoading?: boolean; force?: boolean } = {}) => {
    tableId = tableId ?? tablesStore.activeTableId

    if (tableId) {
      if (!force && viewsByTable.value.get(tableId)) return

      if (!ignoreLoading) isViewsLoading.value = true

      const response = (await $api.dbView.list(tableId)).list as ViewType[]
      if (response) {
        viewsByTable.value.set(
          tableId,
          response.sort((a, b) => a.order! - b.order!),
        )
      }

      if (!ignoreLoading) isViewsLoading.value = false
    }
  }

  const onViewsTabChange = (page: ViewPageType) => {
    router.push({
      name: 'index-typeOrId-projectId-index-index-viewId-viewTitle-slugs',
      params: {
        typeOrId: route.value.params.typeOrId,
        projectId: route.value.params.projectId,
        viewId: route.value.params.viewId,
        viewTitle: activeViewTitleOrId.value,
        slugs: [page],
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

  const isLockedView = computed(() => activeView.value?.lock_type === 'locked')

  const navigateToView = async ({
    view,
    projectId,
    tableId,
    hardReload,
  }: {
    view: ViewType
    projectId: string
    tableId: string
    hardReload?: boolean
  }) => {
    const routeName = 'index-typeOrId-projectId-index-index-viewId-viewTitle'

    if (
      router.currentRoute.value.query &&
      router.currentRoute.value.query.page &&
      router.currentRoute.value.query.page === 'fields'
    ) {
      await router.push({
        name: routeName,
        params: { viewTitle: view.id || '', viewId: tableId, projectId },
        query: router.currentRoute.value.query,
      })
    } else {
      await router.push({ name: routeName, params: { viewTitle: view.id || '', viewId: tableId, projectId } })
    }

    if (hardReload) {
      await router
        .replace({
          name: routeName,
          query: { reload: 'true' },
          params: { viewId: tableId, projectId, viewTitle: view.id || '' },
        })
        .then(() => {
          router.replace({ name: routeName, query: {}, params: { viewId: tableId, viewTitle: view.id || '', projectId } })
        })
    }
  }

  watch(activeViewTitleOrId, () => {
    isPaginationLoading.value = true
  })

  return {
    isLockedView,
    isViewsLoading,
    isViewDataLoading,
    isPaginationLoading,
    loadViews,
    views,
    activeView,
    openedViewsTab,
    onViewsTabChange,
    sharedView,
    viewsByTable,
    activeViewTitleOrId,
    navigateToView,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useViewsStore as any, import.meta.hot))
}
