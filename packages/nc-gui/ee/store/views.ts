import type { ViewType, ViewTypes } from 'nocodb-sdk'
import { acceptHMRUpdate, defineStore } from 'pinia'
import type { ViewPageType } from '~/lib'

export const useViewsStore = defineStore('viewsStore', () => {
  const { $api } = useNuxtApp()

  interface RecentView {
    viewName: string
    viewId: string | undefined
    viewType: ViewTypes
    tableID: string
    baseName: string
    baseId: string
  }

  const router = useRouter()
  const recentViews = ref<RecentView[]>([])
  const route = router.currentRoute

  const bases = useBases()

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
      name: 'index-typeOrId-baseId-index-index-viewId-viewTitle-slugs',
      params: {
        typeOrId: route.value.params.typeOrId,
        baseId: route.value.params.baseId,
        viewId: route.value.params.viewId,
        viewTitle: activeViewTitleOrId.value,
        slugs: [page],
      },
    })
  }

  const changeView = async ({ viewId, tableId, baseId }: { viewId: string | null; tableId: string; baseId: string }) => {
    const routeName = 'index-typeOrId-baseId-index-index-viewId-viewTitle'
    await router.push({ name: routeName, params: { viewTitle: viewId || '', viewId: tableId, baseId } })
  }

  const removeFromRecentViews = ({
    viewId,
    tableId,
    baseId,
  }: {
    viewId?: string | undefined
    tableId: string
    baseId?: string
  }) => {
    if (baseId && !viewId && !tableId) {
      recentViews.value = recentViews.value.filter((f) => f.baseId !== baseId)
    } else if (baseId && tableId && !viewId) {
      recentViews.value = recentViews.value.filter((f) => f.baseId !== baseId || f.tableID !== tableId)
    } else if (tableId && viewId) {
      recentViews.value = recentViews.value.filter((f) => f.viewId !== viewId || f.tableID !== tableId)
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

  const isLockedView = computed(() => activeView.value?.lock_type === 'locked')

  const navigateToView = async ({
    view,
    baseId,
    tableId,
    hardReload,
  }: {
    view: ViewType
    baseId: string
    tableId: string
    hardReload?: boolean
  }) => {
    const routeName = 'index-typeOrId-baseId-index-index-viewId-viewTitle'

    let projectIdOrBaseId = baseId

    if (['base'].includes(route.value.params.typeOrId as string)) {
      projectIdOrBaseId = route.value.params.baseId as string
    }

    if (
      router.currentRoute.value.query &&
      router.currentRoute.value.query.page &&
      router.currentRoute.value.query.page === 'fields'
    ) {
      await router.push({
        name: routeName,
        params: { viewTitle: view.id || '', viewId: tableId, baseId: projectIdOrBaseId },
        query: router.currentRoute.value.query,
      })
    } else {
      await router.push({ name: routeName, params: { viewTitle: view.id || '', viewId: tableId, baseId: projectIdOrBaseId } })
    }

    if (hardReload) {
      await router
        .replace({
          name: routeName,
          query: { reload: 'true' },
          params: { viewId: tableId, baseId: projectIdOrBaseId, viewTitle: view.id || '' },
        })
        .then(() => {
          router.replace({
            name: routeName,
            query: {},
            params: { viewId: tableId, viewTitle: view.id || '', baseId: projectIdOrBaseId },
          })
        })
    }
  }

  watch(activeViewTitleOrId, () => {
    isPaginationLoading.value = true
  })

  watch(activeView, (view) => {
    if (!view) return
    if (!view.base_id) return

    const baseName = bases.basesList.find((p) => p.id === view.base_id)?.title
    recentViews.value = [
      {
        viewId: view.id,
        baseId: view.base_id as string,
        tableID: view.fk_model_id,
        viewName: view.title as string,
        viewType: view.type,
        baseName: baseName as string,
      },
      ...recentViews.value.filter((f) => f.viewId !== view.id || f.tableID !== view.fk_model_id),
    ].splice(0, 10)
  })

  return {
    isLockedView,
    isViewsLoading,
    isViewDataLoading,
    isPaginationLoading,
    loadViews,
    recentViews,
    views,
    activeView,
    openedViewsTab,
    onViewsTabChange,
    sharedView,
    viewsByTable,
    activeViewTitleOrId,
    navigateToView,
    changeView,
    removeFromRecentViews,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useViewsStore as any, import.meta.hot))
}
