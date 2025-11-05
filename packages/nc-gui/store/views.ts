import type { CalendarType, FilterType, GalleryType, KanbanType, MapType, RowColoringInfo, SortType, ViewType } from 'nocodb-sdk'
import { ProjectRoles, ViewSettingOverrideOptions, ViewTypes, WorkspaceUserRoles, ViewTypes as _ViewTypes } from 'nocodb-sdk'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { useTitle } from '@vueuse/core'
import type { ViewPageType } from '~/lib/types'
import { getFormattedViewTabTitle } from '~/helpers/parsers/parserHelpers'
import { DlgViewCopyViewConfigFromAnotherView, DlgViewCreate } from '#components'

// Types and Interfaces
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

export const useViewsStore = defineStore('viewsStore', () => {
  const { $api, $e, $eventBus } = useNuxtApp()

  const { t } = useI18n()

  const { ncNavigateTo, user } = useGlobal()

  const router = useRouter()

  const { meta: metaKey, control } = useMagicKeys()

  const bases = useBases()

  const { getMeta } = useMetas()

  const tablesStore = useTablesStore()

  const workspaceStore = useWorkspace()

  const { refreshCommandPalette } = useCommandPalette()

  const { isUIAllowed } = useRoles()

  const { sharedView } = useSharedView()

  const { openedProject } = storeToRefs(bases)

  const { activeWorkspaceId } = storeToRefs(workspaceStore)

  const { activeTable } = storeToRefs(tablesStore)

  const { isFeatureEnabled } = useBetaFeatureToggle()

  const route = router.currentRoute

  const allRecentViews = ref<RecentView[]>([])

  const viewsByTable = ref<Map<string, ViewType[]>>(new Map())

  const activeSorts = ref<SortType[]>([])

  const activeNestedFilters = ref<FilterType[]>([])

  const isViewsLoading = ref(true)

  const isViewDataLoading = ref(true)

  const isPaginationLoading = ref(false)

  const lastOpenedViewId = ref<string | undefined>(undefined)

  const preFillFormSearchParams = ref('')

  const activeViewRowColorInfo = ref<RowColoringInfo>(defaultRowColorInfo)

  // Computed properties
  const isPublic = computed(() => route.value.meta?.public)

  const recentViews = computed<RecentView[]>(() =>
    allRecentViews.value.filter((f) => f.workspaceId === activeWorkspaceId.value).splice(0, 10),
  )

  const views = computed({
    get: () => (tablesStore.activeTableId ? viewsByTable.value.get(tablesStore.activeTableId) : []) ?? [],
    set: (value) => {
      if (!tablesStore.activeTableId) return
      if (!value) return viewsByTable.value.delete(tablesStore.activeTableId)

      viewsByTable.value.set(tablesStore.activeTableId, value)
    },
  })

  const activeViewTitleOrId = computed(() => {
    if (!route.value.params.viewTitle?.length) {
      // find the default view and navigate to it, if not found navigate to the first one
      const defaultView = views.value?.find((v) => v.is_default) || views.value?.[0]

      return defaultView?.id
    }

    return route.value.params.viewTitle
  })

  const openedViewsTab = computed<ViewPageType>(() => {
    // For types in ViewPageType type
    if (!route.value.params?.slugs || route.value.params.slugs?.length <= 1) return 'view'

    if (['field', 'permissions', 'relation', 'api', 'webhook'].includes(route.value.params.slugs[1] as ViewPageType)) {
      return route.value.params.slugs[1] as ViewPageType
    }

    return 'view'
  })

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

  const activeViewUrlSlug = computed(() => {
    return route.value.params.slugs?.[0] || ''
  })

  const activeViewReadableUrlSlug = computed(() => {
    if (sharedView.value || !activeView.value) return ''

    return getViewReadableUrlSlug({ tableTitle: activeTable.value?.title, viewOrViewTitle: activeView.value })
  })

  const isActiveViewLocked = computed(() => activeView.value?.lock_type === 'locked')
  const isLockedView = computed(() => activeView.value?.lock_type === 'locked')

  const isCopyViewConfigFromAnotherViewFeatureEnabled = computed(() =>
    isFeatureEnabled(FEATURE_FLAG.COPY_VIEW_CONFIG_FROM_ANOTHER_VIEW),
  )

  const refreshViewTabTitle = createEventHook<void>()

  const loadViews = async ({
    tableId,
    ignoreLoading,
    force,
  }: { tableId?: string; ignoreLoading?: boolean; force?: boolean } = {}) => {
    tableId = tableId ?? tablesStore.activeTableId

    let response
    if (tableId) {
      if (!force && viewsByTable.value.get(tableId)) {
        viewsByTable.value.set(
          tableId,
          (viewsByTable.value.get(tableId) ?? []).sort((a, b) => a.order! - b.order!),
        )
        isViewsLoading.value = false
        return viewsByTable.value.get(tableId)
      }
      if (!ignoreLoading) isViewsLoading.value = true

      response = (await $api.dbView.list(tableId)).list as ViewType[]
      if (response) {
        viewsByTable.value.set(
          tableId,
          response.sort((a, b) => a.order! - b.order!),
        )
      }

      if (!ignoreLoading) isViewsLoading.value = false
    }

    return response
  }

  const navigateToView = async ({
    view,
    baseId,
    tableId,
    tableTitle,
    hardReload,
    doNotSwitchTab,
  }: {
    view: ViewType
    baseId: string
    tableId: string
    tableTitle?: string
    hardReload?: boolean
    doNotSwitchTab?: boolean
  }) => {
    const cmdOrCtrl = isMac() ? metaKey.value : control.value

    const routeName = 'index-typeOrId-baseId-index-index-viewId-viewTitle-slugs'

    let baseIdOrBaseId = baseId

    if (['base'].includes(route.value.params.typeOrId as string)) {
      baseIdOrBaseId = route.value.params.baseId as string
    }

    const slugs = doNotSwitchTab ? router.currentRoute.value.params.slugs || [] : []

    if (ncIsArray(slugs)) {
      ;(slugs as string[])[0] = getViewReadableUrlSlug({ tableTitle, viewOrViewTitle: view })
    }

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

  const createView = async (tableId: string, form: CreateViewForm): Promise<ViewType | null> => {
    if (!tableId) return null

    try {
      let data: ViewType | null = null

      switch (form.type) {
        case ViewTypes.GRID:
          data = await $api.dbView.gridCreate(tableId, form)
          break
        case ViewTypes.GALLERY:
          data = await $api.dbView.galleryCreate(tableId, form)
          break
        case ViewTypes.FORM:
          data = await $api.dbView.formCreate(tableId, {
            ...form,
            ...getDefaultViewMetas(ViewTypes.FORM),
          })
          break
        case ViewTypes.KANBAN:
          data = await $api.dbView.kanbanCreate(tableId, form)
          break
        case ViewTypes.MAP:
          data = await $api.dbView.mapCreate(tableId, form)
          break
        case ViewTypes.CALENDAR:
          data = await $api.dbView.calendarCreate(tableId, {
            ...form,
            calendar_range: form.calendar_range.map((range) => ({
              fk_from_column_id: range.fk_from_column_id,
              fk_to_column_id: range.fk_to_column_id,
            })),
          })
          break
      }

      if (data) {
        // Add the new view to the store
        const tableViews = viewsByTable.value.get(tableId) || []
        viewsByTable.value.set(tableId, [...tableViews, data])

        // Refresh command palette
        refreshCommandPalette()

        // Telemetry event
        $e(form.copy_from_id ? 'a:view:duplicate' : 'a:view:create', { view: data.type })

        return data
      }

      return null
    } catch (e: any) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsg(e))
      throw e
    }
  }

  const duplicateView = async (view: ViewType): Promise<ViewType | null> => {
    if (!view?.id) return null

    const views = viewsByTable.value.get(view.fk_model_id) || []
    const uniqueTitle = generateUniqueTitle(`${view.title} copy`, views, 'title', '_', true)

    const getViewSpecificProps = (sourceView: ViewType) => {
      const baseProps = {
        fk_grp_col_id: null,
        fk_geo_data_col_id: null,
        fk_cover_image_col_id: null,
        calendar_range: [] as Array<{
          fk_from_column_id: string
          fk_to_column_id: string | null
        }>,
      }

      switch (sourceView.type) {
        case ViewTypes.GALLERY:
          return {
            ...baseProps,
            fk_cover_image_col_id: (sourceView.view as GalleryType)?.fk_cover_image_col_id || null,
          }
        case ViewTypes.KANBAN:
          return {
            ...baseProps,
            fk_cover_image_col_id: (sourceView.view as KanbanType)?.fk_cover_image_col_id || null,
            fk_grp_col_id: (sourceView.view as KanbanType)?.fk_grp_col_id || null,
          }
        case ViewTypes.MAP:
          return {
            ...baseProps,
            fk_geo_data_col_id: (sourceView.view as MapType)?.fk_geo_data_col_id || null,
          }
        case ViewTypes.CALENDAR:
          return {
            ...baseProps,
            calendar_range:
              (sourceView.view as CalendarType)?.calendar_range?.map((range) => ({
                fk_from_column_id: range.fk_from_column_id as string,
                fk_to_column_id: range.fk_to_column_id as string,
              })) || [],
          }
        default:
          return baseProps
      }
    }

    const viewSpecificProps = getViewSpecificProps(view)

    const duplicateForm: CreateViewForm = {
      title: uniqueTitle,
      type: view.type,
      description: view.description || '',
      copy_from_id: view.id!,
      row_coloring_mode: view.row_coloring_mode!,
      meta: parseProp(view.meta)?.rowColoringInfo ? { rowColoringInfo: parseProp(view.meta).rowColoringInfo } : undefined,
      ...viewSpecificProps,
    }

    return await createView(view.fk_model_id, duplicateForm)
  }

  const deleteView = async (view: ViewType) => {
    if (!view?.id) return

    const activeViewId = activeView.value?.id

    try {
      await $api.dbView.delete(view.id)

      // Remove view from the viewsByTable map
      const tableViews = viewsByTable.value.get(view.fk_model_id) || []
      const updatedViews = tableViews.filter((v) => v.id !== view.id)
      viewsByTable.value.set(view.fk_model_id, updatedViews)

      // Remove from recent views
      removeFromRecentViews({
        viewId: view.id,
        tableId: view.fk_model_id,
        baseId: view.base_id,
      })

      // Refresh command palette
      refreshCommandPalette()

      // Telemetry event
      $e('a:view:delete', { view: view.type })

      // If we deleted the active view, navigate to default or first view
      if (activeViewId === view.id) {
        const remainingViews = viewsByTable.value.get(view.fk_model_id) || []
        const defaultView = remainingViews.find((v) => v.is_default) || remainingViews[0]

        if (defaultView && activeTable.value) {
          await navigateToView({
            view: defaultView,
            baseId: activeTable.value.base_id!,
            tableId: view.fk_model_id,
          })
        } else {
          ncNavigateTo({
            workspaceId: activeWorkspaceId.value,
            baseId: view.base_id,
          })
        }
      }

      return true
    } catch (e: any) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsg(e))
      throw e
    }
  }

  const updateView = async (viewId: string, updates: Partial<ViewType>): Promise<ViewType | null> => {
    try {
      const updatedView = await $api.dbView.update(viewId, updates)

      // Find the table and update the view in the store
      const tableId = activeView.value?.fk_model_id
      if (tableId) {
        const tableViews = viewsByTable.value.get(tableId) || []
        const viewIndex = tableViews.findIndex((v) => v.id === viewId)

        if (viewIndex !== -1) {
          // Replace with the response from API
          tableViews[viewIndex] = updatedView
          viewsByTable.value.set(tableId, [...tableViews])

          // Update recent views if title changed
          if (updatedView.title) {
            allRecentViews.value = allRecentViews.value.map((rv) => {
              if (rv.viewId === viewId && rv.tableID === tableId) {
                rv.viewName = updatedView.title
              }
              return rv
            })
          }

          refreshCommandPalette()

          return updatedView
        }
      }

      return updatedView
    } catch (e: any) {
      console.error(e)
      throw e
    }
  }

  const updateViewMeta = async (
    viewId: string,
    viewType: ViewTypes,
    updates: Record<string, any>,
    args?: {
      skipNetworkCall?: boolean
    },
  ): Promise<ViewType | null> => {
    try {
      let updatedView

      if (!args?.skipNetworkCall) {
        switch (viewType) {
          case ViewTypes.GRID:
            updatedView = await $api.dbView.gridUpdate(viewId, updates)
            break
          case ViewTypes.GALLERY:
            updatedView = await $api.dbView.galleryUpdate(viewId, updates)
            break
          case ViewTypes.KANBAN:
            updatedView = await $api.dbView.kanbanUpdate(viewId, updates)
            break
          case ViewTypes.MAP:
            updatedView = await $api.dbView.mapUpdate(viewId, updates)
            break
          case ViewTypes.CALENDAR:
            updatedView = await $api.dbView.calendarUpdate(viewId, updates)
            break
          case ViewTypes.FORM:
            updatedView = await $api.dbView.formUpdate(viewId, updates)
            break
          default:
            throw new Error(`Unsupported view type for meta update: ${viewType}`)
        }
      } else {
        updatedView = {
          ...activeView.value,
          view: {
            ...(activeView.value || {}).view,
            ...updates,
          },
        }
      }

      // Find the table and update the view in the store
      const tableId = activeView.value?.fk_model_id
      if (tableId) {
        const tableViews = viewsByTable.value.get(tableId) || []
        const viewIndex = tableViews.findIndex((v) => v.id === viewId)

        if (viewIndex !== -1) {
          tableViews[viewIndex] = updatedView
          viewsByTable.value.set(tableId, [...tableViews])
        }
      }

      if (isPublic.value) {
        sharedView.value = {
          ...sharedView.value,
          view: {
            ...(sharedView.value?.view || {}),
            ...updates,
          },
        }
      }

      refreshCommandPalette()

      return updatedView
    } catch (e: any) {
      console.error(e)
      throw e
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
        slugs: [activeViewReadableUrlSlug.value, ...(page !== 'view' ? [page] : [])],
      },
    })
  }

  const changeView = async ({ viewId, tableId, baseId }: { viewId: string | null; tableId: string; baseId: string }) => {
    const routeName = 'index-typeOrId-baseId-index-index-viewId-viewTitle'
    await router.push({ name: routeName, params: { viewTitle: viewId || '', viewId: tableId, baseId } })
  }

  function removeFromRecentViews({ viewId, tableId, baseId }: { viewId?: string | undefined; tableId: string; baseId?: string }) {
    if (baseId && !viewId && !tableId) {
      allRecentViews.value = allRecentViews.value.filter((f) => f.baseId !== baseId)
    } else if (baseId && tableId && !viewId) {
      allRecentViews.value = allRecentViews.value.filter((f) => f.baseId !== baseId || f.tableID !== tableId)
    } else if (tableId && viewId) {
      allRecentViews.value = allRecentViews.value.filter((f) => f.viewId !== viewId || f.tableID !== tableId)
    }
  }

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

  const setCurrentViewExpandedFormMode = async (viewId: string, mode: 'field' | 'attachment', columnId?: string) => {
    /**
     * Update value only if it is EeUI and active view
     */
    if (!isEeUI || !viewId || activeView.value?.id !== viewId) return

    try {
      if (isUIAllowed('viewCreateOrEdit')) {
        await updateView(viewId, {
          expanded_record_mode: mode,
          attachment_mode_column_id: columnId,
        })
      }
    } catch (e: any) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  const setCurrentViewExpandedFormAttachmentColumn = async (viewId: string, columnId: string) => {
    /**
     * Update value only if it is EeUI and active view
     */
    if (!isEeUI || !viewId || activeView.value?.id !== viewId) return

    try {
      if (isUIAllowed('viewCreateOrEdit')) {
        await updateView(viewId, {
          attachment_mode_column_id: columnId,
        })
      }

      Object.assign(activeView.value, { attachment_mode_column_id: columnId })
    } catch (e: any) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  const onOpenViewCreateModal = ({
    title = '',
    type,
    copyViewId,
    groupingFieldColumnId,
    calendarRange,
    coverImageColumnId,
    baseId,
    tableId,
    sourceId,
  }: {
    title?: string
    type: ViewTypes | 'AI'
    copyViewId?: string
    groupingFieldColumnId?: string
    calendarRange?: Array<{
      fk_from_column_id: string
      fk_to_column_id: string | null
    }>
    coverImageColumnId?: string
    baseId: string
    tableId: string
    sourceId?: string
  }) => {
    if (!baseId || !tableId) return

    const isDlgOpen = ref(true)

    const { close } = useDialog(DlgViewCreate, {
      'modelValue': isDlgOpen,
      title,
      type,
      'tableId': tableId,
      'selectedViewId': copyViewId,
      calendarRange,
      groupingFieldColumnId,
      coverImageColumnId,
      'onUpdate:modelValue': closeDialog,
      'baseId': baseId,
      'sourceId': sourceId,
      'onCreated': async (view?: ViewType) => {
        closeDialog()

        refreshCommandPalette()

        if (view) {
          navigateToView({
            view,
            tableId,
            baseId,
            doNotSwitchTab: true,
          })
        }

        $e('a:view:create', { view: view?.type || type })
      },
    })

    function closeDialog() {
      isDlgOpen.value = false

      close(1000)
    }
  }

  const isUserViewOwner = (view?: ViewType, _user: User | null = user.value) => {
    if (!view || !_user) return false

    return (
      view?.owned_by === _user?.id ||
      !!(!view?.owned_by && (_user?.base_roles?.[ProjectRoles.OWNER] || _user?.workspace_roles?.[WorkspaceUserRoles.OWNER]))
    )
  }

  const getCopyViewConfigBtnAccessStatus = (view: ViewType, from: 'view-action-menu' | 'toolbar' = 'view-action-menu') => {
    const result = {
      isDisabled: false,
      tooltip: '',
      isVisible: isEeUI && isUIAllowed('viewCreateOrEdit') && isCopyViewConfigFromAnotherViewFeatureEnabled.value,
    }

    if (!view) return result

    if (view?.lock_type === LockType.Personal && !isUserViewOwner(view)) {
      result.isDisabled = true
      result.tooltip = t('tooltip.onlyViewOwnerCanCopyViewConfig')

      if (from === 'toolbar') {
        result.isVisible = false
      }
    } else if (view?.lock_type === LockType.Locked) {
      result.isDisabled = true
      result.tooltip = t('title.thisViewIsLockType', {
        type: t(viewLockIcons[view?.lock_type]?.title).toLowerCase(),
      })

      if (from === 'toolbar') {
        result.isVisible = false
      }
    } else if ((viewsByTable.value.get(view.fk_model_id) || []).length < 2) {
      result.isDisabled = true
      result.tooltip = t('tooltip.youNeedAtLeastOneExistingViewToCopyConfigurations')

      if (from === 'toolbar') {
        result.isVisible = false
      }
    }

    return result
  }

  const onOpenCopyViewConfigFromAnotherViewModal = ({
    defaultOptions,
    destView = activeView.value,
    onCopy = (_: ViewSettingOverrideOptions[]) => undefined,
  }: {
    defaultOptions?: ViewSettingOverrideOptions[]
    destView?: ViewType
    onCopy?: (selectedCopyViewConfigTypes: ViewSettingOverrideOptions[]) => void
  } = {}) => {
    if (!destView || !isEeUI || !isUIAllowed('viewCreateOrEdit')) return

    // If destination view is locked or if personal and user is not the owner or if table has only one view then return
    if (getCopyViewConfigBtnAccessStatus(destView).isDisabled) {
      return
    }

    const isOpen = ref(true)

    const { close } = useDialog(DlgViewCopyViewConfigFromAnotherView, {
      'modelValue': isOpen,
      'onUpdate:modelValue': closeDialog,
      'destView': destView,
      'defaultSelectedCopyViewConfigTypes': defaultOptions,
      'onCopy': onCopy,
    })

    function closeDialog() {
      isOpen.value = false
      close(1000)
    }
  }

  const copyViewConfigurationFromAnotherView = async (
    destView: ViewType,
    sourceViewId: string,
    settingToOverride: ViewSettingOverrideOptions[],
  ) => {
    if (!sourceViewId || settingToOverride.length === 0 || !destView) {
      return
    }

    try {
      const res = await $api.internal.postOperation(
        activeWorkspaceId.value!,
        destView.base_id!,
        {
          operation: 'viewSettingOverride',
        },
        {
          destinationViewId: destView.id!,
          sourceViewId,
          settingToOverride,
        },
      )

      if (
        destView.is_default &&
        [ViewSettingOverrideOptions.FIELD_ORDER, ViewSettingOverrideOptions.FIELD_VISIBILITY].some((type) =>
          settingToOverride.includes(type),
        )
      ) {
        // default view col order and visibility is stored in column meta so we have to load it again
        await getMeta(destView.fk_model_id!, true)
      }

      if (res?.view && destView.fk_model_id) {
        const tableViews = viewsByTable.value.get(destView.fk_model_id) || []
        const viewIndex = tableViews.findIndex((v) => v.id === destView.id)

        if (viewIndex !== -1) {
          // Replace with the response from API
          tableViews[viewIndex] = res.view
          viewsByTable.value.set(destView.fk_model_id, [...tableViews])

          refreshCommandPalette()
        }
      }

      // Reload view meta as well as data if the destination view is the active view
      if (destView.id === activeView.value?.id) {
        $eventBus.smartsheetStoreEventBus.emit(SmartsheetStoreEvents.COPIED_VIEW_CONFIG, {
          viewId: destView.id,
          copiedOptions: settingToOverride,
        })

        $eventBus.smartsheetStoreEventBus.emit(SmartsheetStoreEvents.FIELD_RELOAD, {
          callback: () => {
            // Load data after fields reload
            forcedNextTick(() => {
              $eventBus.smartsheetStoreEventBus.emit(SmartsheetStoreEvents.DATA_RELOAD)
            })
          },
        })
      }

      message.toast(t('objects.copyViewConfig.viewConfigurationCopied'))

      return true
    } catch (e: any) {
      console.error(e)
      const errorInfo = await extractSdkResponseErrorMsgv2(e)

      if (errorInfo.error === NcErrorType.ERR_FEATURE_NOT_SUPPORTED) {
        message.error(errorInfo.message)
      } else {
        message.error(t('objects.copyViewConfig.errorOccuredWhileCopyingViewConfiguration'), undefined, {
          copyText: errorInfo.message,
        })
      }
    }
  }

  function getViewReadableUrlSlug({ tableTitle, viewOrViewTitle }: { tableTitle?: string; viewOrViewTitle: ViewType | string }) {
    const viewTitle = ncIsObject(viewOrViewTitle) ? (viewOrViewTitle.is_default ? '' : viewOrViewTitle.title) : viewOrViewTitle

    return toReadableUrlSlug([tableTitle, viewTitle])
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

  watch(
    () => [activeView.value?.title, activeView.value?.id],
    () => {
      updateTabTitle()
    },
    {
      flush: 'post',
    },
  )

  /**
   * Keeps the browser URL slug in sync with the view's readable slug.
   * Triggers only when:
   * - The current browser URL slug is missing, OR
   * - The browser URL slug does not match the view's readable slug.
   */
  watch(
    [activeViewReadableUrlSlug, activeViewUrlSlug],
    ([newactiveViewReadableUrlSlug, newActiveViewUrlSlug]) => {
      if (!newactiveViewReadableUrlSlug || newActiveViewUrlSlug === newactiveViewReadableUrlSlug) return

      const slugs = (route.value.params.slugs as string[]) || []

      const newSlug = [newactiveViewReadableUrlSlug]

      if (slugs.length > 1) {
        newSlug.push(...slugs.slice(1))
      }

      router.replace({
        name: 'index-typeOrId-baseId-index-index-viewId-viewTitle-slugs',
        params: {
          ...route.value.params,
          viewTitle: route.value.params.viewTitle || activeView.value?.id,
          slugs: newSlug,
        },
        query: route.value.query,
        force: true,
      })
    },
    {
      immediate: true,
      flush: 'post',
    },
  )

  refreshViewTabTitle.on(() => {
    updateTabTitle()
  })

  return {
    // State
    isLockedView,
    isViewsLoading,
    isViewDataLoading,
    isPaginationLoading,
    recentViews,
    allRecentViews,
    views,
    activeView,
    openedViewsTab,
    viewsByTable,
    activeViewTitleOrId,
    activeSorts,
    activeNestedFilters,
    isActiveViewLocked,
    preFillFormSearchParams,
    lastOpenedViewId,
    activeViewRowColorInfo,
    sharedView,
    isCopyViewConfigFromAnotherViewFeatureEnabled,

    // Methods
    createView,
    updateView,
    updateViewMeta,
    deleteView,
    loadViews,
    onViewsTabChange,
    navigateToView,
    changeView,
    removeFromRecentViews,
    refreshViewTabTitle: refreshViewTabTitle.trigger,
    updateViewCoverImageColumnId,
    duplicateView,
    setCurrentViewExpandedFormMode,
    setCurrentViewExpandedFormAttachmentColumn,
    onOpenViewCreateModal,
    getViewReadableUrlSlug,
    onOpenCopyViewConfigFromAnotherViewModal,
    copyViewConfigurationFromAnotherView,
    isUserViewOwner,
    getCopyViewConfigBtnAccessStatus,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useViewsStore as any, import.meta.hot))
}
