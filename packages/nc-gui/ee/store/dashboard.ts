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
  BaseType,
  ScreenDimensions,
  ScreenPosition,
  StaticTextWidget,
  ViewType,
  Widget,
  WidgetReqType,
  WidgetType,
} from 'nocodb-sdk'
import { AggregateFnType, ButtonActionType, DataSourceType, FontType, WidgetTypeType, chartTypes } from 'nocodb-sdk'
import { computed, extractSdkResponseErrorMsg, message, navigateTo, ref, useNuxtApp, useRouter, watch } from '#imports'
import type { IdAndTitle, LayoutSidebarNode } from '#imports'

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
  const route = router.currentRoute

  const { $api, $e } = useNuxtApp()
  const { t } = useI18n()
  const reloadWidgetDataEventBus = useEventBus('ReloadWidgetData')

  const basesStore = useBases()

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

  const baseStore = useBase()
  const { base } = storeToRefs(baseStore)

  const { loadProjectTables } = useTablesStore()
  const { baseTables } = storeToRefs(useTablesStore())

  const focusedWidgetId = ref<string | undefined>(undefined)
  // NOTE: Instead of using stop propagation on the click handler on the Layout View level
  // (which is responsible for calling resetFocus) and which made problems for example for
  // handling other click event types (e.g. opening and closing the context menu on a widget),
  // we use a temporaryFocusedWidgetId to store the id of the widget that should be focused
  // AFTER the click event on a widget has been handled and BEFORE the event is bubbling up to the Layout View
  // Within the Layout view, we then check whether the temporaryFocusedWidgetId is set and if so,
  // set the focusedWidgetId to it. Otherise we set it to undefined (because the click event was not on a widget).
  const temporaryFocusedWidgetId = ref<string | undefined>(undefined)

  const openedWidgets = ref<Widget[] | null>(null)

  const gridLayout: Ref<WidgetLayoutEntry[]> = ref([])

  const availableColumnsOfSelectedView = ref<Array<ColumnType>>()

  const availableViewsOfSelectedTable = ref<IdAndTitle[] | undefined>()

  const dashboardProject = ref<BaseType | undefined>(undefined)

  /***
   *
   * Computed
   *
   */

  const focusedWidget = computed(() =>
    openedWidgets.value?.find((widget: { id: string | undefined }) => widget.id === focusedWidgetId.value),
  )

  const availableDbProjects = computed(
    () =>
      dashboardProject.value?.linked_db_projects?.map((base) => ({
        id: base.id!,
        title: base.title || 'unknown',
      })) || [],
  )

  const openedProjectId = computed<string>(() => route.value.params.baseId as string)
  const openedLayoutId = computed<string | null>(() => route.value.params.layoutId as string)
  const _openedWorkspaceId = computed<string>(() => route.value.params.typeOrId as string)
  const availableNumericColumnsOfSelectedView = computed(() => {
    if (!availableColumnsOfSelectedView.value) {
      return undefined
    }

    // TODO: check also for other numeric types here (like float)
    return availableColumnsOfSelectedView.value.filter((column) => column.dt && ['integer'].includes(column.dt))
  })

  const availableTablesOfAllDBProjectsLinkedWithDashboardProject = computed(() =>
    Array.from(baseTables.value)
      .map(([_, tables]) => tables)
      .flat()
      .filter((t) => t != null && availableDbProjects.value?.map((dbP) => dbP.id).includes(t.base_id!))
      .map((table) => ({
        id: table.id!,
        title: table.title || 'unknown',
        base: {
          id: table.base_id!,
          title: availableDbProjects.value.find((p) => p.id === table.base_id)?.title || 'unknown',
        },
      })),
  )

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

  async function _fetchSingleLayout({ layoutId: layoutIdParam }: { layoutId?: string; baseId: string }) {
    const layoutId = layoutIdParam || openedLayoutId.value
    if (!layoutId) throw new Error('No Layout id or slug provided')

    try {
      return await $api.dashboard.layoutGet(base.value!.id!, layoutId)
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

  function _getLayoutUrl({ baseId, id, completeUrl }: { baseId: string; id: string; completeUrl?: boolean }) {
    baseId = baseId || openedProjectId.value

    const url = `/${_openedWorkspaceId.value}/${baseId}/layout/${id}`

    return completeUrl ? `${window.location.origin}/#${url}` : url
  }

  async function _createLayout({ layoutTitle, baseId }: { layoutTitle: string; baseId: string }) {
    const layouts = layoutsOfProjects.value[baseId]
    try {
      const createdLayoutData = await $api.dashboard.layoutCreate(baseId, {
        title: layoutTitle,
        base_id: baseId,
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
      await navigateTo(_getLayoutUrl({ id: createdLayoutData.id!, baseId: baseId! }))

      const openedTabs = layoutsOfProjects.value[baseId].map((p: any) => p.id)
      if (!openedTabs.includes(createdLayoutData.id!)) {
        openedTabs.push(createdLayoutData.id!)
      }
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
          console.error('_resetDepsOfSelectedView handing not yet implemented for this visualisation type')
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
    () => basesStore.openedProject,
    async () => {
      if (openedProjectId.value == null) {
        return
      }
      dashboardProject.value = basesStore.openedProject as BaseType
    },
    {
      immediate: true,
    },
  )
  watch([() => availableDbProjects.value], async () => {
    await Promise.all(availableDbProjects.value.map(async (base) => await loadProjectTables(base.id)))
  })
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
        baseId: openedProjectId.value,
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
  function getDashboardProjectUrl(baseId: string, { completeUrl }: { completeUrl?: boolean; publicMode?: boolean } = {}) {
    const path = `/${_openedWorkspaceId.value}/${baseId}/layout`
    if (completeUrl) return `${window.location.origin}/#${path}`

    return path
  }

  async function populateLayouts({ baseId }: { baseId: string }) {
    if (layoutsOfProjects.value[baseId]) return

    await fetchLayouts({ baseId })
  }

  async function fetchLayouts({ withoutLoading, baseId }: { baseId: string; withoutLoading?: boolean }) {
    if (!withoutLoading) isLayoutFetching.value[baseId] = true
    try {
      const fetchedLayouts = (await $api.dashboard.layoutList(baseId)).list

      layoutsOfProjects.value[baseId] = fetchedLayouts.map((layout) => {
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
      if (!withoutLoading) isLayoutFetching.value[baseId] = false
    }
  }
  const resetFocus = () => {
    if (temporaryFocusedWidgetId.value) {
      focusedWidgetId.value = temporaryFocusedWidgetId.value
      temporaryFocusedWidgetId.value = undefined
    } else {
      focusedWidgetId.value = undefined
    }
  }

  const addNewLayout = async ({ baseId }: { baseId: string }) => {
    const layouts = layoutsOfProjects.value[baseId]
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
      baseId,
      layoutTitle: dummyTitle,
    })
  }

  const deleteLayout = async (dashboard: BaseType, layout: LayoutType) => {
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
          await fetchLayouts({ baseId: dashboard.id! })
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

  const openLayout = async ({ layout, baseId }: { layout: LayoutType; baseId: string }) => {
    const url = _getLayoutUrl({ id: layout.id!, baseId })

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
      width: 4,
      height: 4,
    }

    const newElement: Widget = {
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

    const duplicatedWidget = { ...widgetToDuplicate }

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
    temporaryFocusedWidgetId.value = elementId
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
            baseId: newProjectId,
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

  const changeNameOfFocusedChart = (newName: string) => {
    if (!focusedWidget.value || !chartTypes.includes(focusedWidget.value.widget_type)) {
      console.error('changeNameOfFocusedChart: focusedWidget.value is undefined or not a chart widget')
      return
    }
    const updatedWidget = {
      ...focusedWidget.value!,
      data_config: {
        ...focusedWidget.value.data_config,
        name: newName,
      },
    }
    _updateWidgetInAPIAndLocally(updatedWidget)
  }

  const updateIconOfNumberWidget = (newIcon: string) => {
    if (!focusedWidget.value || WidgetTypeType.Number !== focusedWidget.value.widget_type) {
      console.error('updateIconOfNumberWidget: focusedWidget.value is undefined or not a NumberWidget')
      return
    }
    const updatedWidget = {
      ...focusedWidget.value!,
      data_config: {
        ...(focusedWidget.value as NumberWidget).data_config,
        icon: newIcon,
      },
    } as NumberWidget
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

  const changeFontTypeOfFocusedTextWidget = (newFontType: FontType) => {
    if (!focusedWidget.value || ![WidgetTypeType.StaticText].includes(focusedWidget.value.widget_type)) {
      console.error('changeFontTypeOfFocusedTextWidget: focusedWidget.value is undefined or not a Text widget')
      return
    }
    const updatedWidget = {
      ...focusedWidget.value!,
      appearance_config: {
        ...(focusedWidget.value as StaticTextWidget).appearance_config,
        fontType: newFontType,
      },
    }
    _updateWidgetInAPIAndLocally(updatedWidget)
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
    changeNameOfFocusedChart,
    updateIconOfNumberWidget,
    changeFontTypeOfFocusedTextWidget,
  }
})
