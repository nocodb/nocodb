import { defineStore } from 'pinia'
import type {
  AppearanceConfig,
  DataConfig,
  DataSource,
  LayoutType,
  ProjectType,
  ScreenDimensions,
  ScreenPosition,
  Widget,
  WidgetReqType,
  WidgetType,
} from 'nocodb-sdk'
import { AggregateFnType, ButtonActionType, DataSourceType, WidgetTypeType } from 'nocodb-sdk'
import { computed, extractSdkResponseErrorMsg, message, navigateTo, ref, useNuxtApp, useRouter, useTabs, watch } from '#imports'
import type { LayoutSidebarNode } from '~~/lib'
import { TabType } from '~~/lib'

export const availableAggregateFunctions = [
  AggregateFnType.Sum,
  AggregateFnType.Avg,
  AggregateFnType.Count,
  AggregateFnType.Max,
  AggregateFnType.Min,
]

export const availableAggregateFunctionsWithIdAndTitle = availableAggregateFunctions.map((aggregateFn) => {
  return {
    id: aggregateFn.toString(),
    // TODO: use i18n here
    title: aggregateFn.toString(),
  }
})

export const useDashboardStore = defineStore('dashboardStore', () => {
  const router = useRouter()
  const route = $(router.currentRoute)

  const { $api, $e } = useNuxtApp()
  const { t } = useI18n()
  const reloadWidgetDataEventBus = useEventBus('ReloadWidgetData')

  /***
   *
   *
   * Refs
   *
   *
   */
  const isLayoutFetching = ref<Record<string, boolean>>({})

  const layoutsOfProjects = ref<Record<string, LayoutSidebarNode[]>>({})

  const openedLayoutSidebarNode = ref<LayoutSidebarNode | undefined>(undefined)

  const projectStore = useProject()
  const { project } = storeToRefs(projectStore)

  const focusedWidgetId = ref<string | undefined>(undefined)

  const openedWidgets = reactive<Widget[]>([])

  const focusedWidget = computed(() =>
    openedWidgets.find((widget: { id: string | undefined }) => widget.id === focusedWidgetId.value),
  )

  /***
   *
   * Computed
   *
   */

  const openedProjectId = computed<string>(() => route.params.projectId as string)
  const openedLayoutId = computed<string | null>(() => route.params.layoutId as string)
  const _openedWorkspaceId = computed<string>(() => route.params.workspaceId as string)

  /***
   *
   * Private functions
   *
   */
  function _findSingleLayout(layouts: LayoutSidebarNode[], layoutId: string) {
    if (!layouts) {
      console.error('layouts is undefined:')
    }
    return layouts.find((p) => p.id === layoutId)
  }

  async function _fetchSingleLayout({ layoutId: layoutIdParam }: { layoutId?: string; projectId: string }) {
    const layoutId = layoutIdParam || openedLayoutId.value
    if (!layoutId) throw new Error('No Layout id or slug provided')

    try {
      return await $api.dashboard.layoutGet(project.value!.id!, layoutId)
    } catch (e) {
      console.log(e)
      return undefined
    }
  }

  const _parseWidgetFromAPI = (widgetFromAPI: WidgetType): Widget => {
    const dataConfig: DataConfig =
      typeof widgetFromAPI.data_config === 'object' ? widgetFromAPI.data_config : JSON.parse(widgetFromAPI.data_config || '{}')

    const dataSource: DataSource =
      typeof widgetFromAPI.data_source === 'object' ? widgetFromAPI.data_source : JSON.parse(widgetFromAPI.data_source || '{}')

    const appearanceConfig: AppearanceConfig =
      typeof widgetFromAPI.appearance_config === 'object'
        ? widgetFromAPI.appearance_config
        : JSON.parse(widgetFromAPI.appearance_config || '{}')

    return {
      ...widgetFromAPI,
      data_config: dataConfig,
      data_source: dataSource,
      appearance_config: appearanceConfig,
    }
  }

  async function _addTabWhenNestedLayoutIsPopulated({ projectId }: { projectId: string }) {
    const layoutsOfProject = layoutsOfProjects.value[projectId]
    if (!layoutsOfProject) {
      setTimeout(() => {
        _addTabWhenNestedLayoutIsPopulated({ projectId })
      }, 100)
      return
    }

    if (!openedLayoutId.value) return

    const { addTab } = useTabs()

    addTab({
      id: openedLayoutSidebarNode.value!.id!,
      title: openedLayoutSidebarNode.value!.title || 'NO TITLE',
      type: TabType.LAYOUT,
      projectId: openedProjectId.value,
    })
  }

  function _getLayoutUrl({ projectId, id, completeUrl }: { projectId: string; id: string; completeUrl?: boolean }) {
    projectId = projectId || openedProjectId.value

    const url = `/ws/${_openedWorkspaceId.value}/nc/${projectId}/layout/${id}`

    return completeUrl ? `${window.location.origin}/#${url}` : url
  }

  async function _createLayout({ layoutTitle, projectId }: { layoutTitle: string; projectId: string }) {
    const layouts = layoutsOfProjects.value[projectId]
    try {
      const createdLayoutData = await $api.dashboard.layoutCreate(projectId, {
        title: layoutTitle,
        project_id: projectId,
      })

      layouts.push({
        ...createdLayoutData,
        isLeaf: false,
        key: createdLayoutData.id!,
        parentNodeId: undefined,
        children: [],
      })

      openedLayoutSidebarNode.value = _findSingleLayout(layouts, createdLayoutData.id!)
      await navigateTo(_getLayoutUrl({ id: createdLayoutData.id!, projectId: projectId! }))

      const openedTabs = layoutsOfProjects.value[projectId].map((p: any) => p.id)
      if (!openedTabs.includes(createdLayoutData.id!)) {
        openedTabs.push(createdLayoutData.id!)
      }

      const { addTab } = useTabs()

      addTab({
        id: createdLayoutData.id!,
        title: createdLayoutData.title || 'NO TITLE',
        type: TabType.LAYOUT,
        projectId,
      })
    } catch (e) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsg(e as any))
    }
  }

  /***
   *
   * watchers
   *
   */
  watch(
    openedLayoutId,
    async (newLayoutId, previousDashboardId) => {
      //
      // Helper functions/props
      //
      const isDashboardNewButAlreadyOpen = openedLayoutSidebarNode.value?.new && openedLayoutSidebarNode.value.id === newLayoutId

      const setPreviousDashboardAsOld = () => {
        if (previousDashboardId) {
          const previousDashboard = _findSingleLayout(layoutsOfProjects.value[openedProjectId.value], previousDashboardId)
          if (previousDashboard?.new) {
            previousDashboard.new = false
          }
        }
      }

      const noNewLayoutId = newLayoutId == null

      //
      // Main function flow
      //
      if (noNewLayoutId) {
        openedLayoutSidebarNode.value = undefined
        return
      }

      if (isDashboardNewButAlreadyOpen) return

      setPreviousDashboardAsOld()

      openedLayoutSidebarNode.value = undefined

      // TODO extract that out in a seperate function START
      const fetchedDashboard: LayoutType | undefined = await _fetchSingleLayout({
        layoutId: newLayoutId,
        projectId: openedProjectId.value,
      })

      if (fetchedDashboard == null) {
        console.error('fetchedLayout is undefined')
        return
      }

      if (fetchedDashboard?.id !== openedLayoutId.value) {
        console.error('fetchedLayout.id !== openedLayoutId.value')
        return
      }

      const mandatorySidebarNodeProps = {
        isLeaf: true,
        key: fetchedDashboard.id,
      }
      openedLayoutSidebarNode.value = { ...fetchedDashboard, ...mandatorySidebarNodeProps }
      // TODO extract that out in a seperate function END

      _fetchAndSetWidgetsOfOpenedLayoutId(openedLayoutId.value)

      _addTabWhenNestedLayoutIsPopulated({
        projectId: openedProjectId.value,
      })
    },
    {
      immediate: true,
      deep: true,
    },
  )

  /***
   *
   * Public functions
   *
   */
  function getDashboardProjectUrl(projectId: string, { completeUrl }: { completeUrl?: boolean; publicMode?: boolean } = {}) {
    const path = `/ws/${_openedWorkspaceId.value}/nc/${projectId}/layout`
    if (completeUrl) return `${window.location.origin}/#${path}`

    return path
  }

  async function fetchLayouts({ withoutLoading, projectId }: { projectId: string; withoutLoading?: boolean }) {
    if (!withoutLoading) isLayoutFetching.value[projectId] = true
    try {
      const fetchedLayouts = (await $api.dashboard.layoutList(projectId)).list

      layoutsOfProjects.value[projectId] = fetchedLayouts.map((layout) => {
        return {
          ...layout,
          isLeaf: true,
          key: layout.id!,
        }
      })
    } catch (e) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsg(e as any))
    } finally {
      if (!withoutLoading) isLayoutFetching.value[projectId] = false
    }
  }

  const resetFocus = () => {
    focusedWidgetId.value = undefined
  }

  const addNewLayout = async ({ projectId }: { projectId: string }) => {
    const layouts = layoutsOfProjects.value[projectId]
    if (!Array.isArray(layouts)) {
      console.error('Layouts not defined or not an array')
      message.error('Error while creating Layout')
      return
    }
    let dummyTitle = 'Layout'
    let conflictCount = 0
    while (layouts?.find((layout) => layout.title === dummyTitle)) {
      conflictCount++
      dummyTitle = `Layout ${conflictCount}`
    }

    await _createLayout({
      projectId,
      layoutTitle: dummyTitle,
    })
  }

  const deleteLayout = async (dashboard: ProjectType, layout: LayoutType) => {
    $e('c:layout:delete')
    Modal.confirm({
      title: `${t('msg.info.deleteLayoutConfirmation')} (${layout.title})?`,
      wrapClassName: 'nc-modal-layout-delete',
      okText: t('general.yes'),
      okType: 'danger',
      cancelText: t('general.no'),
      width: 450,
      async onOk() {
        try {
          await $api.dashboard.layoutDelete(dashboard.id!, layout.id!)
          await fetchLayouts({ projectId: dashboard.id! })
          message.info(t('msg.info.layoutDeleted'))
          $e('a:layout:delete')
        } catch (e) {
          message.error(await extractSdkResponseErrorMsg(e))
          console.error(e)
        }
      },
    })
  }

  async function _fetchAndSetWidgetsOfOpenedLayoutId(layoutId: string) {
    const widgets = await $api.dashboard.widgetList(layoutId)

    if (widgets == null) {
      console.error('widgetsData is undefined')
    }

    // TODO: fix typing/implementation mismatch here: type expects there is a 'list' property where the widgets are stored in
    const parsedWidgets = widgets.list.map(_parseWidgetFromAPI)

    openedWidgets.splice(0, openedWidgets.length, ...parsedWidgets)
  }

  const openLayout = async ({ layout, projectId }: { layout: LayoutType; projectId: string }) => {
    const url = _getLayoutUrl({ id: layout.id!, projectId })

    await navigateTo(url)
  }

  const updatePositionOfWidgetById = (id: string, newPosition: ScreenPosition) => {
    if (openedWidgets == null) {
      console.error('Could not find UI element to update position')
      return
    }

    const elementToUpdate = openedWidgets.find((widget: Widget) => widget.id === id)
    if (elementToUpdate == null) {
      console.error('Could not find UI element to update position')
      return
    }

    const updatedElement: Widget = {
      ...elementToUpdate,
      appearance_config: {
        ...elementToUpdate.appearance_config,
        screenPosition: newPosition,
      },
    }

    openedWidgets.splice(
      0,
      openedWidgets.length,
      ...openedWidgets.map((element: any) => {
        if (element.id === id) {
          return updatedElement
        }
        return element
      }),
    )
    $api.dashboard.widgetUpdate(openedLayoutId.value!, updatedElement.id, updatedElement)
  }

  const updateScreenDimensionsOfWidgetById = (id: string, newScreenDimensions: ScreenDimensions) => {
    console.log('updateScreenDimensionsOfElementById', id, newScreenDimensions)
    if (openedWidgets == null) {
      console.error('Could not find UI element to update screen dimensions')
      return
    }

    const elementToUpdate = openedWidgets.find((widget: Widget) => widget.id === id)
    if (elementToUpdate == null) {
      console.error('Could not find widget to update dimensions for')
      return
    }

    const updatedElement: Widget = {
      ...elementToUpdate,
      appearance_config: {
        ...elementToUpdate.appearance_config,
        screenDimensions: newScreenDimensions,
      },
    }

    openedWidgets.splice(
      0,
      openedWidgets.length,
      ...openedWidgets.map((element: any) => {
        if (element.id === id) {
          return updatedElement
        }
        return element
      }),
    )

    $api.dashboard.widgetUpdate(openedLayoutId.value!, updatedElement.id, updatedElement)
  }

  const addWidget = async (widget_type: WidgetTypeType) => {
    const newElement: Widget = {
      id: Date.now().toString(),
      layout_id: openedLayoutId.value!,
      schema_version: '1.0.0',
      appearance_config: {
        name: 'New element',
        description: 'Empty description',
        screenPosition: {
          x: 10,
          y: 20,
        },
        screenDimensions: {
          width: 100,
          height: 100,
        },
      },
      widget_type,
      data_source: {
        dataSourceType: DataSourceType.INTERNAL,
      },
      data_config: {
        ...(widget_type === WidgetTypeType.Button
          ? { buttonText: '[My Button]', actionType: ButtonActionType.OPEN_EXTERNAL_URL, url: 'http://example.com' }
          : {}),
      },
      // TODO: make this (and similar rubber ducking checks) cleaner
    }

    const dashboardWidgetReqType: WidgetReqType = {
      appearance_config: newElement.appearance_config,
      layout_id: openedLayoutId.value!,
      data_config: newElement.data_config,
      data_source: newElement.data_source,
      schema_version: newElement.schema_version,
      widget_type: newElement.widget_type,
    }

    const widgetFromAPI = await $api.dashboard.widgetCreate(openedLayoutId.value!, dashboardWidgetReqType)
    const parsedWidgetFromAPI = _parseWidgetFromAPI(widgetFromAPI)
    openedWidgets.push(parsedWidgetFromAPI)
    focusedWidgetId.value = parsedWidgetFromAPI.id
  }

  const removeWidgetById = async (id: string) => {
    const idxOfElementToRemove = openedWidgets.findIndex((element: { id: string }) => element.id === id)
    const elementToRemove = openedWidgets[idxOfElementToRemove]
    if (idxOfElementToRemove == null) {
      console.error('Could not find UI element to remove')
      return
    }
    await $api.dashboard.widgetDelete(openedLayoutId.value!, elementToRemove.id)
    openedWidgets.splice(idxOfElementToRemove, 1)
  }

  const updateFocusedWidgetByElementId = async (elementId: string) => {
    focusedWidgetId.value = elementId
  }

  return {
    openedLayoutSidebarNode: readonly(openedLayoutSidebarNode),
    layoutsOfProjects: readonly(layoutsOfProjects),
    openedWidgets: readonly(openedWidgets),
    focusedWidget: readonly(focusedWidget),
    reloadWidgetDataEventBus: readonly(reloadWidgetDataEventBus),
    getDashboardProjectUrl,
    fetchLayouts,
    openLayout,
    addNewLayout,
    deleteLayout,
    addWidget,
    updateFocusedWidgetByElementId,
    updatePositionOfWidgetById,
    updateScreenDimensionsOfWidgetById,
    removeWidgetById,
    resetFocus,
  }
})
