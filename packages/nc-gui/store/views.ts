import type { CalendarType, FilterType, GalleryType, KanbanType, MapType, SortType, ViewType, ViewTypes } from 'nocodb-sdk'
import { ViewTypes as _ViewTypes } from 'nocodb-sdk'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { useTitle } from '@vueuse/core'
import type { ViewPageType } from '~/lib/types'
import { getFormattedViewTabTitle } from '~/helpers/parsers/parserHelpers'

export const useViewsStore = defineStore('viewsStore', () => {
  const { $api } = useNuxtApp()
  interface RecentView {
    viewName: string
    viewId: string | undefined
    viewType: ViewTypes
    tableID: string
    isDefault: boolean
    baseName: string
    tableName: string
    workspaceId: string
    baseId: string
  }

  const router = useRouter()
  // Store recent views from all Workspaces
  const allRecentViews = ref<RecentView[]>([])
  const route = router.currentRoute

  const bases = useBases()
  const { openedProject } = storeToRefs(bases)

  const tablesStore = useTablesStore()

  const { activeWorkspaceId } = storeToRefs(useWorkspace())

  const { meta: metaKey, control } = useMagicKeys()

  const recentViews = computed<RecentView[]>(() =>
    allRecentViews.value.filter((f) => f.workspaceId === activeWorkspaceId.value).splice(0, 10),
  )

  const viewsByTable = ref<Map<string, ViewType[]>>(new Map())
  const views = computed({
    get: () => (tablesStore.activeTableId ? viewsByTable.value.get(tablesStore.activeTableId) : []) ?? [],
    set: (value) => {
      if (!tablesStore.activeTableId) return
      if (!value) return viewsByTable.value.delete(tablesStore.activeTableId)

      viewsByTable.value.set(tablesStore.activeTableId, value)
    },
  })

  // Both are synced with `useSmartsheetStore` state
  // Sort of active view
  const activeSorts = ref<SortType[]>([])
  // Filters of active view (used for local filters)
  const activeNestedFilters = ref<FilterType[]>([])

  const isViewsLoading = ref(true)
  const isViewDataLoading = ref(true)
  const isPublic = computed(() => route.value.meta?.public)

  const { activeTable } = storeToRefs(useTablesStore())

  const activeViewTitleOrId = computed(() => {
    if (!route.value.params.viewTitle?.length) {
      // find the default view and navigate to it, if not found navigate to the first one
      const defaultView = views.value?.find((v) => v.is_default) || views.value?.[0]

      return defaultView?.id
    }

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

  const isActiveViewLocked = computed(() => activeView.value?.lock_type === 'locked')

  // Used for Grid View Pagination
  // TODO: Disable by default when group by is enabled
  const isPaginationLoading = ref(false)

  const preFillFormSearchParams = ref('')

  const refreshViewTabTitle = createEventHook<void>()

  const loadViews = async ({
    tableId,
    ignoreLoading,
    force,
  }: { tableId?: string; ignoreLoading?: boolean; force?: boolean } = {}) => {
    tableId = tableId ?? tablesStore.activeTableId

    if (tableId) {
      if (!force && viewsByTable.value.get(tableId)) {
        viewsByTable.value.set(
          tableId,
          (viewsByTable.value.get(tableId) ?? []).sort((a, b) => a.order! - b.order!),
        )

        return
      }
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
      allRecentViews.value = allRecentViews.value.filter((f) => f.baseId !== baseId)
    } else if (baseId && tableId && !viewId) {
      allRecentViews.value = allRecentViews.value.filter((f) => f.baseId !== baseId || f.tableID !== tableId)
    } else if (tableId && viewId) {
      allRecentViews.value = allRecentViews.value.filter((f) => f.viewId !== viewId || f.tableID !== tableId)
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

      isViewDataLoading.value = true

      try {
        if (tablesStore.activeTable) tablesStore.activeTable.isViewsLoading = true

        await loadViews()
      } catch (e) {
        console.error(e)
      } finally {
        if (tablesStore.activeTable) tablesStore.activeTable.isViewsLoading = false
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
    doNotSwitchTab,
  }: {
    view: ViewType
    baseId: string
    tableId: string
    hardReload?: boolean
    doNotSwitchTab?: boolean
  }) => {
    const cmdOrCtrl = isMac() ? metaKey.value : control.value

    const routeName = 'index-typeOrId-baseId-index-index-viewId-viewTitle-slugs'

    let baseIdOrBaseId = baseId

    if (['base'].includes(route.value.params.typeOrId as string)) {
      baseIdOrBaseId = route.value.params.baseId as string
    }

    const slugs = doNotSwitchTab ? router.currentRoute.value.params.slugs : undefined

    if (
      router.currentRoute.value.query &&
      router.currentRoute.value.query.page &&
      router.currentRoute.value.query.page === 'fields'
    ) {
      if (cmdOrCtrl) {
        await navigateTo(
          router.resolve({
            name: routeName,
            params: {
              viewTitle: view.id || '',
              viewId: tableId,
              baseId: baseIdOrBaseId,
              slugs,
            },
            query: router.currentRoute.value.query,
          }).href,
          {
            open: navigateToBlankTargetOpenOption,
          },
        )
      } else {
        await router.push({
          name: routeName,
          params: {
            viewTitle: view.id || '',
            viewId: tableId,
            baseId: baseIdOrBaseId,
            slugs,
          },
          query: router.currentRoute.value.query,
        })
      }
    } else {
      if (cmdOrCtrl) {
        await navigateTo(
          router.resolve({
            name: routeName,
            params: {
              viewTitle: view.id || '',
              viewId: tableId,
              baseId: baseIdOrBaseId,
              slugs,
            },
          }).href,
          {
            open: navigateToBlankTargetOpenOption,
          },
        )
      } else {
        await router.push({
          name: routeName,
          params: {
            viewTitle: view.id || '',
            viewId: tableId,
            baseId: baseIdOrBaseId,
            slugs,
          },
        })
      }
    }

    if (!cmdOrCtrl && hardReload) {
      await router
        .replace({
          name: routeName,
          query: { reload: 'true' },
          params: {
            viewId: tableId,
            baseId: baseIdOrBaseId,
            viewTitle: view.id || '',
            slugs,
          },
        })
        .then(() => {
          router.replace({
            name: routeName,
            query: {},
            params: {
              viewId: tableId,
              viewTitle: view.id || '',
              baseId: baseIdOrBaseId,
              slugs,
            },
          })
        })
    }
  }

  watch(activeView, (view) => {
    if (!view) return
    if (!view.base_id) return

    const tableName = tablesStore.baseTables.get(view.base_id)?.find((t) => t.id === view.fk_model_id)?.title

    const baseName = bases.basesList.find((p) => p.id === view.base_id)?.title
    allRecentViews.value = [
      {
        viewId: view.id,
        baseId: view.base_id as string,
        tableID: view.fk_model_id,
        isDefault: !!view.is_default,
        viewName: view.is_default ? (tableName as string) : view.title,
        viewType: view.type,
        workspaceId: activeWorkspaceId.value,
        tableName: tableName as string,
        baseName: baseName as string,
      },
      ...allRecentViews.value.filter((f) => f.viewId !== view.id || f.tableID !== view.fk_model_id),
    ]
  })

  const updateTabTitle = () => {
    if (!activeView.value || !activeView.value.base_id) {
      if (openedProject.value?.title) {
        useTitle(openedProject.value?.title)
      }
      return
    }

    const tableName = tablesStore.baseTables
      .get(activeView.value.base_id)
      ?.find((t) => t.id === activeView.value.fk_model_id)?.title

    const baseName = bases.basesList.find((p) => p.id === activeView.value.base_id)?.title

    useTitle(
      getFormattedViewTabTitle({
        viewName: activeView.value.title,
        tableName: tableName || '',
        baseName: baseName || '',
        isDefaultView: !!activeView.value.is_default,
        isSharedView: !!sharedView.value?.id,
      }),
    )
  }

  const updateViewCoverImageColumnId = ({ columnIds, metaId }: { columnIds: Set<string>; metaId: string }) => {
    if (!viewsByTable.value.get(metaId)) return

    let isColumnUsedAsCoverImage = false

    for (const view of viewsByTable.value.get(metaId) || []) {
      if (
        [_ViewTypes.GALLERY, _ViewTypes.KANBAN].includes(view.type) &&
        view.view?.fk_cover_image_col_id &&
        columnIds.has(view.view?.fk_cover_image_col_id)
      ) {
        isColumnUsedAsCoverImage = true
        break
      }
    }

    if (!isColumnUsedAsCoverImage) return

    viewsByTable.value.set(
      metaId,
      (viewsByTable.value.get(metaId) || [])
        .map((view) => {
          if (
            [_ViewTypes.GALLERY, _ViewTypes.KANBAN].includes(view.type) &&
            view.view?.fk_cover_image_col_id &&
            columnIds.has(view.view?.fk_cover_image_col_id)
          ) {
            view.view.fk_cover_image_col_id = null
          }
          return view
        })
        .sort((a, b) => a.order! - b.order!),
    )
  }

  const duplicateView = async (view: ViewType) => {
    if (!view?.id) return

    const views = viewsByTable.value.get(view.fk_model_id) || []

    const uniqueTitle = generateUniqueTitle(`${view.title} copy`, views, 'title', '_', true)

    const payload: {
      title: string
      type: ViewTypes
      description?: string
      copy_from_id: string | null
      // for kanban view only
      fk_grp_col_id: string | null
      fk_geo_data_col_id: string | null

      // for calendar view only
      calendar_range: Array<{
        fk_from_column_id: string
        fk_to_column_id: string | null // for ee only
      }>
      fk_cover_image_col_id: string | null
    } = {
      title: uniqueTitle,
      type: view.type,
      description: view.description || '',
      copy_from_id: view.id!,
      fk_grp_col_id: null,
      fk_geo_data_col_id: null,
      fk_cover_image_col_id: null,
      calendar_range: [],
    }

    try {
      switch (payload.type) {
        case _ViewTypes.GRID:
          return await $api.dbView.gridCreate(view.fk_model_id, payload)

        case _ViewTypes.GALLERY:
          payload.fk_cover_image_col_id = (view.view as GalleryType)?.fk_cover_image_col_id || null

          return await $api.dbView.galleryCreate(view.fk_model_id, payload)

        case _ViewTypes.FORM:
          return await $api.dbView.formCreate(view.fk_model_id, payload)

        case _ViewTypes.KANBAN:
          payload.fk_cover_image_col_id = (view.view as KanbanType)?.fk_cover_image_col_id || null
          payload.fk_grp_col_id = (view.view as KanbanType)?.fk_grp_col_id || null

          return await $api.dbView.kanbanCreate(view.fk_model_id, payload)

        case _ViewTypes.MAP:
          payload.fk_geo_data_col_id = (view.view as MapType)?.fk_geo_data_col_id || null

          return await $api.dbView.mapCreate(view.fk_model_id, payload)

        case _ViewTypes.CALENDAR:
          payload.calendar_range =
            (view.view as CalendarType)?.calendar_range?.map((range) => ({
              fk_from_column_id: range.fk_from_column_id as string,
              fk_to_column_id: range.fk_to_column_id as string,
            })) || []

          return await $api.dbView.calendarCreate(view.fk_model_id, payload)
      }
    } catch (e: any) {
      message.error(e.message)
    }
  }

  refreshViewTabTitle.on(() => {
    updateTabTitle()
  })

  watch(
    () => [activeView.value?.title, activeView.value?.id],
    () => {
      updateTabTitle()
    },
    {
      flush: 'post',
    },
  )

  return {
    isLockedView,
    isViewsLoading,
    isViewDataLoading,
    isPaginationLoading,
    loadViews,
    recentViews,
    allRecentViews,
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
    activeSorts,
    activeNestedFilters,
    isActiveViewLocked,
    preFillFormSearchParams,
    refreshViewTabTitle: refreshViewTabTitle.trigger,
    updateViewCoverImageColumnId,
    duplicateView,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useViewsStore as any, import.meta.hot))
}
