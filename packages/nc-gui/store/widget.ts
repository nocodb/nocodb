import type { WidgetType } from 'nocodb-sdk'

export const useWidgetStore = defineStore('widget', () => {
  const { $api } = useNuxtApp()
  const route = useRoute()
  const { activeWorkspaceId } = storeToRefs(useWorkspace())
  const bases = useBases()
  const { openedProject } = storeToRefs(bases)

  // State
  const widgets = ref<Map<string, WidgetType[]>>(new Map())
  const isLoading = ref(false)
  const isLoadingWidget = ref(false)

  // Getters
  const activeDashboardId = computed(() => route.params.dashboardId as string)

  const activeDashboardWidgets = computed(() => {
    if (!activeDashboardId.value) return []
    return widgets.value.get(activeDashboardId.value) || []
  })

  const selectedWidget = ref<WidgetType | null>(null)

  // Actions
  const loadWidgets = async ({ dashboardId, force = false }: { dashboardId: string; force?: boolean }) => {
    if (!activeWorkspaceId.value || !openedProject.value?.id) {
      return []
    }

    const existingWidgets = widgets.value.get(dashboardId)
    if (existingWidgets && !force) {
      return existingWidgets
    }

    try {
      isLoading.value = true

      const response = (await $api.internal.getOperation(activeWorkspaceId.value, openedProject.value.id, {
        operation: 'widgetList',
        dashboardId,
      })) as WidgetType[]

      widgets.value.set(dashboardId, response)
      return response
    } catch (e) {
      console.error(e)
      return []
    } finally {
      isLoading.value = false
    }
  }

  const getWidget = async (widgetId: string) => {
    if (!activeWorkspaceId.value || !openedProject.value?.id) return null

    try {
      isLoadingWidget.value = true

      return (await $api.internal.getOperation(activeWorkspaceId.value, openedProject.value.id, {
        operation: 'widgetGet',
        widgetId,
      })) as WidgetType
    } catch (e) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsgv2(e))
      return null
    } finally {
      isLoadingWidget.value = false
    }
  }

  const createWidget = async (dashboardId: string, widgetData: Partial<WidgetType>) => {
    if (!activeWorkspaceId.value || !openedProject.value?.id) return null

    try {
      isLoading.value = true

      const created = await $api.internal.postOperation(
        activeWorkspaceId.value,
        openedProject.value.id,
        {
          operation: 'widgetCreate',
        },
        {
          ...widgetData,
          fk_dashboard_id: dashboardId,
        },
      )

      const dashboardWidgets = widgets.value.get(dashboardId) || []
      dashboardWidgets.push(created)
      widgets.value.set(dashboardId, dashboardWidgets)

      return created
    } catch (e) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsgv2(e))
      return null
    } finally {
      isLoading.value = false
    }
  }

  const updateWidget = async (
    dashboardId = activeDashboardId.value,
    widgetId: string,
    updates: Partial<WidgetType>,
    options?: {
      skipNetworkCall?: boolean
    },
  ) => {
    if (!activeWorkspaceId.value || !openedProject.value?.id) return null

    try {
      isLoading.value = true

      const widget = widgets.value.get(dashboardId)?.find((w) => w.id === widgetId)
      const updated = options?.skipNetworkCall
        ? {
            ...widget,
            ...updates,
          }
        : await $api.internal.postOperation(
            activeWorkspaceId.value,
            openedProject.value.id,
            {
              operation: 'widgetUpdate',
            },
            {
              ...updates,
              id: widgetId,
              widgetId,
            },
          )

      const dashboardWidgets = widgets.value.get(dashboardId) || []
      const index = dashboardWidgets.findIndex((w) => w.id === widgetId)
      if (index !== -1) {
        dashboardWidgets[index] = updated as unknown as WidgetType
        widgets.value.set(dashboardId, dashboardWidgets)
      }

      if (selectedWidget.value?.id === widgetId) {
        selectedWidget.value = updated as unknown as WidgetType
      }

      return updated
    } catch (e) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsgv2(e))
      return null
    } finally {
      isLoading.value = false
    }
  }

  const deleteWidget = async (dashboardId: string, widgetId: string) => {
    if (!activeWorkspaceId.value || !openedProject.value?.id) return null

    try {
      isLoading.value = true

      await $api.internal.postOperation(
        activeWorkspaceId.value,
        openedProject.value.id,
        {
          operation: 'widgetDelete',
        },
        {
          widgetId,
        },
      )

      // Update local state
      const dashboardWidgets = widgets.value.get(dashboardId) || []
      const filtered = dashboardWidgets.filter((w) => w.id !== widgetId)
      widgets.value.set(dashboardId, filtered)

      return true
    } catch (e) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsgv2(e))
      return false
    } finally {
      isLoading.value = false
    }
  }

  const updateWidgetPosition = async (dashboardId: string, widgetId: string, position: WidgetType['position']) => {
    return await updateWidget(dashboardId, widgetId, { position })
  }

  const clearWidgets = (dashboardId?: string) => {
    if (dashboardId) {
      widgets.value.delete(dashboardId)
    } else {
      widgets.value.clear()
    }
  }

  return {
    // State
    widgets,
    isLoading,
    isLoadingWidget,

    // Getters
    activeDashboardWidgets,
    selectedWidget,

    // Actions
    loadWidgets,
    getWidget,
    createWidget,
    updateWidget,
    deleteWidget,
    updateWidgetPosition,
    clearWidgets,
  }
})

// Enable HMR
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useWidgetStore, import.meta.hot))
}
