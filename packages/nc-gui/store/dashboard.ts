import { defineStore } from 'pinia'
import type { Ref } from 'vue'
import type {
  AppearanceConfig,
  ButtonWidget,
  ColumnType,
  DataConfig,
  DataConfigAggregated2DChart,
  DataConfigNumber,
  DataSource,
  DataSourceInternal,
  LayoutType,
  NumberWidget,
  ProjectType,
  ScreenDimensions,
  ScreenPosition,
  StaticTextWidget,
  ViewType,
  Widget,
  WidgetReqType,
  WidgetType,
} from 'nocodb-sdk'
import { AggregateFnType, ButtonActionType, DataSourceType, FontType, WidgetTypeType, chartTypes } from 'nocodb-sdk'
import { computed, extractSdkResponseErrorMsg, message, navigateTo, ref, useNuxtApp, useRouter, useTabs, watch } from '#imports'
import type { LayoutSidebarNode } from '~~/lib'
import { TabType } from '~~/lib'
import type { IdAndTitle, TableWithProject } from '~~/components/layouts/types'

interface LayoutEntry {
  x: number
  y: number
  w: number
  h: number
  i: string
  static: boolean
}

interface WidgetLayoutEntry extends LayoutEntry {
  widgetId: string
}

export const availableAggregateFunctions = [
  AggregateFnType.Sum,
  AggregateFnType.Avg,
  AggregateFnType.Count,
  AggregateFnType.Max,
  AggregateFnType.Min,
]

export const availableButtonActionTypes = [
  ButtonActionType.OPEN_EXTERNAL_URL,
  ButtonActionType.DELETE_RECORD,
  ButtonActionType.OPEN_LAYOUT,
  ButtonActionType.UPDATE_RECORD,
]

const availableFontTypes = [
  FontType.HEADING1,
  FontType.HEADING2,
  FontType.HEADING3,
  FontType.SUB_HEADING_1,
  FontType.SUB_HEADING_2,
  FontType.BODY,
  FontType.CAPTION,
]
export const availableFontTypesWithIdAndTitle = availableFontTypes?.map((fontType) => ({
  id: fontType,
  // TODO: use i18n here
  title: fontType,
}))

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
  const availableTablesOfAllDBProjectsLinkedWithDashboardProject = ref<TableWithProject[] | undefined>()

  const isLayoutFetching = ref<Record<string, boolean>>({})

  const layoutsOfProjects = ref<Record<string, LayoutSidebarNode[]>>({})

  const openedLayoutSidebarNode = ref<LayoutSidebarNode | undefined>(undefined)

  const projectStore = useProject()
  const { project } = storeToRefs(projectStore)

  const { loadProjectTables } = useTablesStore()
  const { projectTables } = storeToRefs(useTablesStore())

  const focusedWidgetId = ref<string | undefined>(undefined)

  const openedWidgets = ref<Widget[] | null>(null)

  const gridLayout: Ref<WidgetLayoutEntry[]> = ref([])

  const availableColumnsOfSelectedView = ref<Array<ColumnType>>()

  const availableViewsOfSelectedTable = ref<IdAndTitle[] | undefined>()

  /***
   *
   * Computed
   *
   */

  const focusedWidget = computed(() =>
    openedWidgets.value?.find((widget: { id: string | undefined }) => widget.id === focusedWidgetId.value),
  )

  const linkedDbProjects = computed(() => project.value?.linked_db_projects)

  const availableDbProjects = computed(
    () =>
      linkedDbProjects.value?.map((project) => ({
        id: project.id!,
        title: project.title || 'unknown',
      })) || [],
  )

  const openedProjectId = computed<string>(() => route.params.projectId as string)
  const openedLayoutId = computed<string | null>(() => route.params.layoutId as string)
  const _openedWorkspaceId = computed<string>(() => route.params.workspaceId as string)
  const availableNumericColumnsOfSelectedView = computed(() => {
    if (!availableColumnsOfSelectedView.value) {
      return undefined
    }

    // TODO: check also for other numeric types here (like float)
    return availableColumnsOfSelectedView.value.filter((column) => column.dt && ['integer'].includes(column.dt))
  })

  /***
   *
   * Private functions
   *
   */

  const _updateLayoutInAPIAndLocally = async (updatedLayout: LayoutSidebarNode) => {
    // 1. Update the API
    await $api.dashboard.layoutUpdate(openedProjectId.value!, updatedLayout.id!, updatedLayout)
    // 2. Update the local object
    openedLayoutSidebarNode.value = updatedLayout
  }

  const _updateWidgetInAPIAndLocally = async (updatedWidget: Widget) => {
    // 1. Update the API
    await $api.dashboard.widgetUpdate(openedLayoutId.value!, updatedWidget.id, updatedWidget)
    if (openedWidgets.value == null) {
      throw new Error('openedWidgets.value is undefined')
    }

    // 2. Update the local object in collection
    openedWidgets.value = openedWidgets.value.map((wid: Widget) => {
      if (wid.id === updatedWidget.id) {
        return updatedWidget
      } else {
        return wid
      }
    })
  }

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
      console.error(e)
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

      // TODO: Check this - looks like nonsense, to find the just created layout again
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

  const _resetDepsOfSelectedView = () => {
    availableColumnsOfSelectedView.value = undefined
    if (focusedWidget.value?.data_config) {
      switch (focusedWidget.value?.widget_type) {
        case WidgetTypeType.LineChart:
        case WidgetTypeType.PieChart:
        case WidgetTypeType.BarChart: {
          ;(focusedWidget.value.data_config as DataConfigAggregated2DChart).xAxisColId = undefined
          // ;(focusedWidget.value.dataLink as ChartDataLink).xDataColumnTitle = undefined
          ;(focusedWidget.value.data_config as DataConfigAggregated2DChart).yAxisColId = undefined
          // ;(focusedWidget.value.dataLink as ChartDataLink).yDataColumnTitle = undefined
          break
        }
        case WidgetTypeType.Number: {
          ;(focusedWidget.value.data_config as DataConfigNumber).colId = undefined

          break
        }
        default: {
          alert('_resetDepsOfSelectedView handing not yet implemented for this visualisation type')
          break
        }
      }
      // TODO: handle other dataSourceTypes as well, probably via command pattern etc
      if (focusedWidget.value.data_source?.dataSourceType === DataSourceType.INTERNAL) {
        ;(focusedWidget.value.data_source as DataSourceInternal).viewId = undefined
      }
    }
  }

  const _resetDepsOfSelectedTable = () => {
    availableViewsOfSelectedTable.value = undefined
    if (focusedWidget.value?.data_config) {
      // TODO: handle other dataSourceTypes as well, probably via command pattern etc
      if (focusedWidget.value.data_source?.dataSourceType === DataSourceType.INTERNAL) {
        ;(focusedWidget.value.data_source as DataSourceInternal).viewId = undefined
      }
    }
    _resetDepsOfSelectedView()
  }

  /***
   *
   * watchers
   *
   */
  watch(
    () => (focusedWidget.value?.data_source as DataSourceInternal)?.tableId,
    async () => {
      availableViewsOfSelectedTable.value = undefined
      const currentTableId = (focusedWidget.value?.data_source as DataSourceInternal)?.tableId
      if (currentTableId) {
        const response = (await $api.dbView.list(currentTableId)).list as ViewType[]
        if (response) {
          availableViewsOfSelectedTable.value = response
            .sort((a, b) => a.order! - b.order!)
            .map((view) => ({
              id: view.id!,
              title: view.title || 'unknown',
            }))
        }
      }
    },
  )
  watch(
    () => openedWidgets.value,
    (newOpenedWidgets, oldOpenedWidgets) => {
      if (newOpenedWidgets != null && oldOpenedWidgets == null) {
        gridLayout.value = newOpenedWidgets.map((widget) => {
          return {
            x: widget.appearance_config.screenPosition.x,
            y: widget.appearance_config.screenPosition.y,
            w: widget.appearance_config.screenDimensions.width,
            h: widget.appearance_config.screenDimensions.height,
            i: widget.id,
            static: false,
            widgetId: widget.id,
          } as WidgetLayoutEntry
        })
      }
    },
    {
      immediate: true,
      deep: true,
    },
  )

  watch(availableDbProjects, async () => {
    if (availableDbProjects.value == null || availableDbProjects.value.length === 0) {
      availableTablesOfAllDBProjectsLinkedWithDashboardProject.value = []
      return
    }
    await Promise.all(availableDbProjects.value.map(async (project) => await loadProjectTables(project.id)))

    availableTablesOfAllDBProjectsLinkedWithDashboardProject.value = Array.from(projectTables.value)
      .map(([_, tables]) => tables)
      .flat()
      .filter((t) => t != null)
      .map((table) => ({
        id: table.id!,
        title: table.title || 'unknown',
        project: {
          id: table.project_id!,
          title: availableDbProjects.value.find((p) => p.id === table.project_id)?.title || 'unknown',
        },
      }))
  })

  watch(
    openedLayoutId,
    async (newLayoutId) => {
      openedWidgets.value = null
      const noNewLayoutId = newLayoutId == null

      if (noNewLayoutId) {
        openedLayoutSidebarNode.value = undefined
        return
      }

      openedLayoutSidebarNode.value = undefined

      const fetchedLayout: LayoutType | undefined = await _fetchSingleLayout({
        layoutId: newLayoutId,
        projectId: openedProjectId.value,
      })

      if (fetchedLayout == null) {
        console.error('fetchedLayout is undefined')
        return
      }

      if (fetchedLayout?.id !== openedLayoutId.value) {
        console.error('fetchedLayout.id !== openedLayoutId.value')
        return
      }

      const mandatorySidebarNodeProps = {
        isLeaf: true,
        key: fetchedLayout.id,
      }
      openedLayoutSidebarNode.value = { ...fetchedLayout, ...mandatorySidebarNodeProps }
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

  watch(
    [
      () => (focusedWidget.value?.data_source as DataSourceInternal)?.tableId,
      () => (focusedWidget.value?.data_source as DataSourceInternal)?.viewId,
    ],
    async ([newTableId, newViewId], [_oldTableId, _oldViewId]) => {
      availableColumnsOfSelectedView.value = undefined
      if (newViewId && newTableId) {
        const columnsOfTable = (await $api.dbTable.read(newTableId)).columns
        availableColumnsOfSelectedView.value = columnsOfTable
      }
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

  async function populateLayouts({ projectId }: { projectId: string }) {
    if (layoutsOfProjects.value[projectId]) return

    await fetchLayouts({ projectId })
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

    openedWidgets.value = parsedWidgets
  }

  const openLayout = async ({ layout, projectId }: { layout: LayoutType; projectId: string }) => {
    const url = _getLayoutUrl({ id: layout.id!, projectId })

    await navigateTo(url)
  }

  const updatePositionOfWidgetById = (id: string, newPosition: ScreenPosition) => {
    if (openedWidgets.value == null) {
      console.error('Could not find UI element to update position')
      return
    }

    const elementToUpdate = openedWidgets.value.find((widget: Widget) => widget.id === id)
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

    openedWidgets.value = openedWidgets.value.map((element: any) => {
      if (element.id === id) {
        return updatedElement
      }
      return element
    })
    $api.dashboard.widgetUpdate(openedLayoutId.value!, updatedElement.id, updatedElement)
  }

  const updateScreenDimensionsOfWidgetById = (id: string, newScreenDimensions: ScreenDimensions) => {
    if (openedWidgets.value == null) {
      console.error('Could not find UI element to update screen dimensions')
      return
    }

    const elementToUpdate = openedWidgets.value.find((widget: Widget) => widget.id === id)
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

    openedWidgets.value = openedWidgets.value.map((element: any) => {
      if (element.id === id) {
        return updatedElement
      }
      return element
    })

    $api.dashboard.widgetUpdate(openedLayoutId.value!, updatedElement.id, updatedElement)
  }

  const addWidget = async (
    widget_type: WidgetTypeType,
    screenPosition: {
      x: number
      y: number
    } = {
      x: 2,
      y: 2,
    },
  ) => {
    if (openedWidgets.value == null) {
      console.error('openedWidgets.value is undefined')
      return
    }

    const defaultScreenDimensions = {
      width: 2,
      height: 2,
    }

    const newElement: Widget = {
      id: Date.now().toString(),
      layout_id: openedLayoutId.value!,
      schema_version: '1.0.0',
      appearance_config: {
        // screenPosition: {
        //   x: screenPosition.x - defaultScreenDimensions.width / 2,
        //   y: screenPosition.y - defaultScreenDimensions.height / 2,
        // },
        screenPosition,
        screenDimensions: defaultScreenDimensions,
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

    const widgetReqType: WidgetReqType = {
      appearance_config: newElement.appearance_config,
      layout_id: openedLayoutId.value!,
      data_config: newElement.data_config,
      data_source: newElement.data_source,
      schema_version: newElement.schema_version,
      widget_type: newElement.widget_type,
    }

    const widgetFromAPI = await $api.dashboard.widgetCreate(openedLayoutId.value!, widgetReqType)
    const parsedWidgetFromAPI = _parseWidgetFromAPI(widgetFromAPI)
    openedWidgets.value.push(parsedWidgetFromAPI)
    focusedWidgetId.value = parsedWidgetFromAPI.id

    gridLayout.value.push({
      x: parsedWidgetFromAPI.appearance_config.screenPosition.x,
      y: parsedWidgetFromAPI.appearance_config.screenPosition.y,
      w: parsedWidgetFromAPI.appearance_config.screenDimensions.width,
      h: parsedWidgetFromAPI.appearance_config.screenDimensions.height,
      i: parsedWidgetFromAPI.id,
      static: false,
      widgetId: parsedWidgetFromAPI.id,
    } as WidgetLayoutEntry)
  }

  const duplicateWidget = async (widgetId: string) => {
    if (openedWidgets.value == null) {
      console.error('openedWidgets.value is undefined')
      return
    }
    const widgetToDuplicate = openedWidgets.value.find((widget: { id: string }) => widget.id === widgetId)

    if (widgetToDuplicate == null) {
      console.error('Could not find widget to duplicate')
      return
    }

    const duplicatedWidget = { ...widgetToDuplicate } // Shallow copy the widget object
    duplicatedWidget.id = Date.now().toString() // Generate a new ID for the duplicated widget

    const widgetReqType: WidgetReqType = {
      appearance_config: duplicatedWidget.appearance_config,
      layout_id: openedLayoutId.value!,
      data_config: duplicatedWidget.data_config,
      data_source: duplicatedWidget.data_source,
      schema_version: duplicatedWidget.schema_version,
      widget_type: duplicatedWidget.widget_type,
    }

    const widgetFromAPI = await $api.dashboard.widgetCreate(openedLayoutId.value!, widgetReqType)
    const parsedWidgetFromAPI = _parseWidgetFromAPI(widgetFromAPI)
    openedWidgets.value.push(parsedWidgetFromAPI)
    focusedWidgetId.value = parsedWidgetFromAPI.id

    gridLayout.value.push({
      x: parsedWidgetFromAPI.appearance_config.screenPosition.x,
      y: parsedWidgetFromAPI.appearance_config.screenPosition.y,
      w: parsedWidgetFromAPI.appearance_config.screenDimensions.width,
      h: parsedWidgetFromAPI.appearance_config.screenDimensions.height,
      i: parsedWidgetFromAPI.id,
      static: false,
      widgetId: parsedWidgetFromAPI.id,
    } as WidgetLayoutEntry)
  }

  const removeWidgetById = async (id: string) => {
    if (openedWidgets.value == null) {
      console.error('openedWidgets.value is undefined')
      return
    }

    const elementToRemove = openedWidgets.value.find((element: { id: string }) => element.id === id)
    if (elementToRemove == null) {
      console.error('Could not find UI element to remove')
      return
    }
    await $api.dashboard.widgetDelete(openedLayoutId.value!, elementToRemove.id)
    openedWidgets.value = openedWidgets.value.filter((element: { id: string }) => element.id !== id)
    gridLayout.value = gridLayout.value.filter((element) => element.i !== id)
  }

  const updateFocusedWidgetByElementId = async (elementId: string) => {
    focusedWidgetId.value = elementId
  }

  // Widget Data Config methods

  const changeSelectedProjectIdAndTableIdOfFocusedWidget = (newProjectId: string, newTableId: string) => {
    _resetDepsOfSelectedTable()
    if (focusedWidget.value?.data_source) {
      // TODO: handle other dataSourceTypes as well, probably via command pattern etc
      if (focusedWidget.value.data_source?.dataSourceType === DataSourceType.INTERNAL) {
        const updatedWidget = reactive({
          ...focusedWidget.value!,
          data_source: reactive({
            ...focusedWidget.value.data_source,
            tableId: newTableId,
            projectId: newProjectId,
          }),
        })
        _updateWidgetInAPIAndLocally(updatedWidget)
      }
    }
  }
  const changeSelectedViewIdOfFocusedWidget = (newViewId: string) => {
    _resetDepsOfSelectedView()
    if (focusedWidget.value?.data_source) {
      // TODO: handle other dataSourceTypes as well, probably via command pattern etc
      if (focusedWidget.value.data_source?.dataSourceType === DataSourceType.INTERNAL) {
        const updatedWidget = {
          ...focusedWidget.value!,
          data_source: {
            ...focusedWidget.value.data_source,
            viewId: newViewId,
          },
        }
        _updateWidgetInAPIAndLocally(updatedWidget)
      }
    }
  }

  const changeSelectedNumberColumnIdOfFocusedWidget = (newNumberColumnId: string) => {
    if (!focusedWidget.value || ![WidgetTypeType.Number].includes(focusedWidget.value.widget_type)) {
      console.error('changeSelectedNumberColumnIdOfFocusedWidget: focusedWidget.value is undefined or not a chart')
      return
    }
    _updateWidgetInAPIAndLocally({
      ...focusedWidget.value!,
      data_config: {
        ...focusedWidget.value!.data_config,
        colId: newNumberColumnId,
      },
    })
  }

  const changeAggregateFunctionOfFocusedWidget = (newAggregateFunctionId: string) => {
    if (
      !focusedWidget.value ||
      ![WidgetTypeType.Number, WidgetTypeType.LineChart, WidgetTypeType.BarChart, WidgetTypeType.PieChart].includes(
        focusedWidget.value.widget_type,
      )
    ) {
      console.error('changeAggregateFunctionOfFocusedWidget: focusedWidget.value is undefined or not a chart')
      return
    }
    if (!Object.values(AggregateFnType).includes(newAggregateFunctionId as AggregateFnType)) {
      console.error(`changeAggregateFunctionOfFocusedWidget: '${newAggregateFunctionId}' is not a valid AggregateFnType`)
      return
    }
    if ([WidgetTypeType.Number, ...chartTypes].includes(focusedWidget.value.widget_type)) {
      _updateWidgetInAPIAndLocally({
        ...focusedWidget.value,
        data_config: {
          ...focusedWidget.value.data_config,
          aggregateFunction: newAggregateFunctionId as AggregateFnType,
        },
      })
    }
  }

  const changeSelectRecordsModeForNumberWidgetDataConfig = (newVal: 'all_records' | 'specific_records') => {
    if (
      !focusedWidget.value ||
      ![
        WidgetTypeType.Number,
        WidgetTypeType.BarChart,
        WidgetTypeType.LineChart,
        WidgetTypeType.PieChart,
        WidgetTypeType.ScatterPlot,
      ].includes(focusedWidget.value.widget_type)
    ) {
      console.error('changeSelectRecordsModeForNumberWidgetDataConfig: focusedWidget.value is undefined or not a Number widget')
      return
    }
    _updateWidgetInAPIAndLocally({
      ...focusedWidget.value,
      data_config: {
        ...focusedWidget.value.data_config,
        selectRecordsMode: newVal,
      },
    })
  }

  const changeRecordCountOrFieldSummaryForNumberWidgetDataConfig = (newVal: 'record_count' | 'field_summary') => {
    if (!focusedWidget.value || ![WidgetTypeType.Number, ...chartTypes].includes(focusedWidget.value.widget_type)) {
      console.error(
        'changeRecordCountOrFieldSummaryForNumberWidgetDataConfig: focusedWidget.value is undefined or not a Number/Chart widget',
      )
      return
    }
    _updateWidgetInAPIAndLocally({
      ...focusedWidget.value,
      data_config: {
        ...focusedWidget.value.data_config,
        recordCountOrFieldSummary: newVal,
      },
    })
  }

  const changeDescriptionOfNumberWidget = (newDescription: string) => {
    if (!focusedWidget.value || ![WidgetTypeType.Number].includes(focusedWidget.value.widget_type)) {
      console.error('changeDescriptionOfNumberWidget: focusedWidget.value is undefined or not a Number widget')
      return
    }
    _updateWidgetInAPIAndLocally({
      ...focusedWidget.value,
      data_config: {
        ...focusedWidget.value.data_config,
        description: newDescription,
      },
    })
  }

  const changeNameOfNumberWidget = (newName: string) => {
    if (!focusedWidget.value || ![WidgetTypeType.Number].includes(focusedWidget.value.widget_type)) {
      console.error('changeNameOfNumberWidget: focusedWidget.value is undefined or not a Number widget')
      return
    }
    _updateWidgetInAPIAndLocally({
      ...focusedWidget.value,
      data_config: {
        ...focusedWidget.value.data_config,
        name: newName,
      },
    })
  }

  const changeChartTypeOfFocusedChartElement = (newChartType: string) => {
    if (!focusedWidget.value || !chartTypes.includes(focusedWidget.value.widget_type)) {
      console.error('changeChartTypeOfFocusedChartElement: focusedWidget.value is undefined or not a chart')
      return
    }
    if (!newChartType || !chartTypes.includes(newChartType as WidgetTypeType)) {
      console.error('changeChartTypeOfFocusedChartElement: newChartType is undefined or not a valid chart type')
      return
    }
    const updatedWidget = {
      ...focusedWidget.value!,
      widget_type: newChartType as WidgetTypeType,
    }
    _updateWidgetInAPIAndLocally(updatedWidget)
  }

  const changeSelectedXColumnIdOfFocusedWidget = (newXColumnId: string) => {
    if (!focusedWidget.value || !chartTypes.includes(focusedWidget.value.widget_type)) {
      console.error('changeSelectedXColumnIfOfFocusedWidget: focusedWidget.value is undefined or not a chart')
      return
    }
    const updatedWidget = {
      ...focusedWidget.value!,
      data_config: {
        ...focusedWidget.value.data_config,
        xAxisColId: newXColumnId,
      },
    }
    _updateWidgetInAPIAndLocally(updatedWidget)
  }

  const changeSelectedXAxisOrderByOfFocusedWidget = (newXAxisOrderBy: 'x_val' | 'y_val') => {
    if (!focusedWidget.value || !chartTypes.includes(focusedWidget.value.widget_type)) {
      console.error('changeSelectedXColumnIfOfFocusedWidget: focusedWidget.value is undefined or not a chart')
      return
    }
    const updatedWidget = {
      ...focusedWidget.value!,
      data_config: {
        ...focusedWidget.value.data_config,
        xAxisOrderBy: newXAxisOrderBy,
      },
    }
    _updateWidgetInAPIAndLocally(updatedWidget)
  }

  const changexAxisOrderDirectionOfFocusedWidget = (newXAxisOrderDirection: 'asc' | 'desc') => {
    if (!focusedWidget.value || !chartTypes.includes(focusedWidget.value.widget_type)) {
      console.error('changeSelectedXColumnIfOfFocusedWidget: focusedWidget.value is undefined or not a chart')
      return
    }
    const updatedWidget = {
      ...focusedWidget.value!,
      data_config: {
        ...focusedWidget.value.data_config,
        xAxisOrderDirection: newXAxisOrderDirection,
      },
    }
    _updateWidgetInAPIAndLocally(updatedWidget)
  }

  const changeSelectedYColumnIdOfFocusedWidget = (newYColumnId: string) => {
    if (!focusedWidget.value || !chartTypes.includes(focusedWidget.value.widget_type)) {
      console.error('changeSelectedXColumnIfOfFocusedWidget: focusedWidget.value is undefined or not a chart')
      return
    }
    // ;(focusedWidget.value.data_config as DataConfigAggregated2DChart).yAxisColId = newYColumnId
    const updatedWidget = {
      ...focusedWidget.value!,
      data_config: {
        ...focusedWidget.value.data_config,
        yAxisColId: newYColumnId,
      },
    }
    _updateWidgetInAPIAndLocally(updatedWidget)
  }

  const changeTextOfFocusedTextElement = (newText: string) => {
    if (!focusedWidget.value || ![WidgetTypeType.StaticText].includes(focusedWidget.value.widget_type)) {
      console.error('changeTextOfFocusedTextElement: focusedWidget.value is undefined or not a Text widget')
      return
    }
    const updatedWidget = {
      ...focusedWidget.value!,
      data_config: {
        ...focusedWidget.value.data_config,
        text: newText,
      },
    }
    _updateWidgetInAPIAndLocally(updatedWidget)
  }

  const changeUrlOfFocusedTextElement = (newUrl: string) => {
    if (!focusedWidget.value || ![WidgetTypeType.StaticText].includes(focusedWidget.value.widget_type)) {
      console.error('changeUrlOfFocusedTextElement: focusedWidget.value is undefined or not a Text widget')
      return
    }

    const currentWidgetConf = focusedWidget.value as StaticTextWidget

    if (currentWidgetConf.data_config.staticTextFunction?.type !== 'url') {
      console.error('changeUrlOfFocusedTextElement: staticTextFunction.type is not url')
      return
    }
    const updatedWidget: StaticTextWidget = {
      ...currentWidgetConf,
      data_config: {
        ...currentWidgetConf.data_config,
        staticTextFunction: {
          type: 'url',
          url: newUrl,
        },
      },
    }
    _updateWidgetInAPIAndLocally(updatedWidget)
  }

  // TODO: use types from skd for function signature
  const changeFunctionTypeOfStaticTextWidget = (newFunctionType: false | 'url') => {
    // if (!focusedWidget.value || ![WidgetTypeType.StaticText].includes(focusedWidget.value.widget_type)) {
    if (!focusedWidget.value || focusedWidget.value.widget_type !== WidgetTypeType.StaticText) {
      console.error('changeFunctionTypeOfStaticTextWidget: focusedWidget.value is undefined or not a Text widget')
      return
    }

    const currentWidgetConf = focusedWidget.value as StaticTextWidget
    let updatedWidget: StaticTextWidget
    if (newFunctionType === false) {
      updatedWidget = {
        ...currentWidgetConf!,
        data_config: {
          ...currentWidgetConf.data_config,
          hasFunction: false,
        },
      }
    } else {
      updatedWidget = {
        ...currentWidgetConf!,
        data_config: {
          ...currentWidgetConf.data_config,
          hasFunction: true,
          staticTextFunction: currentWidgetConf.data_config.staticTextFunction || {
            type: 'url',
            url: '',
          },
        },
      }
    }
    _updateWidgetInAPIAndLocally(updatedWidget)
  }

  const changeButtonActionTypeOfFocusedWidget = (newActionType: ButtonActionType) => {
    if (!focusedWidget.value || ![WidgetTypeType.Button].includes(focusedWidget.value.widget_type)) {
      console.error('changeButtonActionTypeOfFocusedWidget: focusedWidget.value is undefined or not a button')
      return
    }
    const updatedWidget = {
      ...focusedWidget.value!,
      data_config: {
        ...(focusedWidget.value as ButtonWidget).data_config,
        actionType: newActionType,
      },
    }
    _updateWidgetInAPIAndLocally(updatedWidget)
  }

  const changeButtonTextOfFocusedButtonWidget = (newButtonText: string) => {
    if (!focusedWidget.value || ![WidgetTypeType.Button].includes(focusedWidget.value.widget_type)) {
      console.error('changeButtonActionTypeOfFocusedWidget: focusedWidget.value is undefined or not a button')
      return
    }
    const updatedWidget = {
      ...focusedWidget.value!,
      data_config: {
        ...(focusedWidget.value as ButtonWidget).data_config,
        buttonText: newButtonText,
      },
    }
    _updateWidgetInAPIAndLocally(updatedWidget)
  }

  const changeExternalUrlOfFocusedButtonWidget = (newExternalUrl: string) => {
    if (!focusedWidget.value || ![WidgetTypeType.Button].includes(focusedWidget.value.widget_type)) {
      console.error('changeButtonActionTypeOfFocusedWidget: focusedWidget.value is undefined or not a button')
      return
    }
    if ((focusedWidget.value as ButtonWidget).data_config.actionType !== ButtonActionType.OPEN_EXTERNAL_URL) {
      console.error('Trying to change external url of a button which is not of correct ActionType')
      return
    }
    const updatedWidget = {
      ...focusedWidget.value!,
      data_config: {
        ...(focusedWidget.value as ButtonWidget).data_config,
        url: newExternalUrl,
      },
    }
    _updateWidgetInAPIAndLocally(updatedWidget)
  }

  const _changeColorPropertyOfFocusedWidget = (
    newColor: string,
    colorPropertyName: 'fillColor' | 'textColor' | 'borderColor' | 'iconColor',
  ) => {
    if (!focusedWidget.value || ![WidgetTypeType.Number].includes(focusedWidget.value.widget_type)) {
      console.error(
        `_changeColorPropertyOfFocusedWidget (for property ${colorPropertyName}): focusedWidget.value is undefined or not a button`,
      )
      return
    }
    const updatedWidget = {
      ...focusedWidget.value!,
      appearance_config: {
        ...(focusedWidget.value as NumberWidget).appearance_config,
        [colorPropertyName]: newColor,
      },
    }
    _updateWidgetInAPIAndLocally(updatedWidget)
  }

  const changeFillColorOfFocusedWidget = (newFillColor: string) => {
    _changeColorPropertyOfFocusedWidget(newFillColor, 'fillColor')
  }

  const changeBorderColorOfFocusedWidget = (newBorderColor: string) => {
    _changeColorPropertyOfFocusedWidget(newBorderColor, 'borderColor')
  }

  const changeTextColorOfFocusedWidget = (newTextColor: string) => {
    _changeColorPropertyOfFocusedWidget(newTextColor, 'textColor')
  }

  const changeIconColorOfFocusedWidget = (newIconColor: string) => {
    _changeColorPropertyOfFocusedWidget(newIconColor, 'iconColor')
  }

  const changeLayoutPaddingVertical = (newPaddingVertical: string) => {
    if (!openedLayoutSidebarNode.value) {
      console.error('changeLayoutGap: changeLayoutPaddingVertical.value is undefined')
      return
    }
    const updatedLayout: LayoutSidebarNode = {
      ...openedLayoutSidebarNode.value,
      grid_padding_vertical: newPaddingVertical,
    }

    _updateLayoutInAPIAndLocally(updatedLayout)
  }

  const changeLayoutPaddingHorizontal = (newPaddingHorizontal: string) => {
    if (!openedLayoutSidebarNode.value) {
      console.error('changeLayoutGap: changeLayoutPaddingHorizontal.value is undefined')
      return
    }
    const updatedLayout: LayoutSidebarNode = {
      ...openedLayoutSidebarNode.value,
      grid_padding_horizontal: newPaddingHorizontal,
    }

    _updateLayoutInAPIAndLocally(updatedLayout)
  }

  const changeLayoutGap = (newLayoutGap: string) => {
    if (!openedLayoutSidebarNode.value) {
      console.error('changeLayoutGap: openedLayoutSidebarNode.value is undefined')
      return
    }
    const updatedLayout: LayoutSidebarNode = {
      ...openedLayoutSidebarNode.value,
      grid_gap: newLayoutGap,
    }

    _updateLayoutInAPIAndLocally(updatedLayout)
  }

  return {
    openedLayoutSidebarNode: readonly(openedLayoutSidebarNode),
    openedLayoutId: readonly(openedLayoutId),
    layoutsOfProjects: readonly(layoutsOfProjects),
    openedWidgets: readonly(openedWidgets),
    focusedWidget: readonly(focusedWidget),
    reloadWidgetDataEventBus: readonly(reloadWidgetDataEventBus),
    availableTablesOfAllDBProjectsLinkedWithDashboardProject: readonly(availableTablesOfAllDBProjectsLinkedWithDashboardProject),
    availableViewsOfSelectedTable: readonly(availableViewsOfSelectedTable),
    availableColumnsOfSelectedView: readonly(availableColumnsOfSelectedView),
    availableNumericColumnsOfSelectedView: readonly(availableNumericColumnsOfSelectedView),
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
    duplicateWidget,
    resetFocus,
    changeSelectedProjectIdAndTableIdOfFocusedWidget,
    changeSelectedNumberColumnIdOfFocusedWidget,
    changeSelectedViewIdOfFocusedWidget,
    changeSelectedXColumnIdOfFocusedWidget,
    changeSelectedYColumnIdOfFocusedWidget,
    changeRecordCountOrFieldSummaryForNumberWidgetDataConfig,
    changeSelectRecordsModeForNumberWidgetDataConfig,
    changeAggregateFunctionOfFocusedWidget,
    changeChartTypeOfFocusedChartElement,
    populateLayouts,
    changeNameOfNumberWidget,
    changeDescriptionOfNumberWidget,
    changeSelectedXAxisOrderByOfFocusedWidget,
    changexAxisOrderDirectionOfFocusedWidget,
    changeTextOfFocusedTextElement,
    changeFunctionTypeOfStaticTextWidget,
    changeUrlOfFocusedTextElement,
    changeButtonActionTypeOfFocusedWidget,
    changeButtonTextOfFocusedButtonWidget,
    changeExternalUrlOfFocusedButtonWidget,
    changeFillColorOfFocusedWidget,
    changeBorderColorOfFocusedWidget,
    changeTextColorOfFocusedWidget,
    changeIconColorOfFocusedWidget,
    changeLayoutGap,
    changeLayoutPaddingHorizontal,
    changeLayoutPaddingVertical,
    gridLayout,
  }
})
