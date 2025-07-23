import { EventType, type WidgetPayload, type WidgetType } from 'nocodb-sdk'

export const useWidgetStore = defineStore('widget', () => {
  const { $api, $ncSocket } = useNuxtApp()

  const { activeWorkspaceId } = storeToRefs(useWorkspace())

  const { activeDashboardId, activeDashboard, sharedDashboardState } = storeToRefs(useDashboardStore())

  const bases = useBases()

  const { openedProject, activeProjectId } = storeToRefs(bases)

  const widgets = ref<Map<string, WidgetType[]>>(new Map<string, WidgetType[]>())

  const activeDashboardWidgets = computed<Array<WidgetType>>(() => {
    if (!activeDashboardId.value) return []
    return widgets.value.get(activeDashboardId.value) || (activeDashboard.value as any)?.widgets || []
  })

  const selectedWidget = ref<WidgetType | null>(null)

  const loadWidgets = async ({ dashboardId, force = false }: { dashboardId: string; force?: boolean }) => {
    if (!activeWorkspaceId.value || !openedProject.value?.id) {
      return []
    }

    const existingWidgets = widgets.value.get(dashboardId)
    if (existingWidgets && !force) {
      return existingWidgets
    }

    try {
      const response = (await $api.internal.getOperation(activeWorkspaceId.value, openedProject.value.id, {
        operation: 'widgetList',
        dashboardId,
      })) as WidgetType[]

      widgets.value.set(dashboardId, response)
      return response
    } catch (e) {
      console.error(e)
      return []
    }
  }

  const getWidget = async (widgetId: string) => {
    if (!activeWorkspaceId.value || !openedProject.value?.id) return null

    try {
      const widget = (await $api.internal.getOperation(activeWorkspaceId.value, openedProject.value.id, {
        operation: 'widgetGet',
        widgetId,
      })) as WidgetType

      if (selectedWidget.value?.id === widgetId) {
        selectedWidget.value = widget as unknown as WidgetType
      }

      return widget
    } catch (e) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsgv2(e as any))
      return null
    }
  }

  const createWidget = async (dashboardId: string, widgetData: Partial<WidgetType>) => {
    if (!activeWorkspaceId.value || !openedProject.value?.id) return null

    try {
      const created = (await $api.internal.postOperation(
        activeWorkspaceId.value,
        openedProject.value.id,
        {
          operation: 'widgetCreate',
        },
        {
          ...widgetData,
          fk_dashboard_id: dashboardId,
        },
      )) as WidgetType

      const dashboardWidgets = widgets.value.get(dashboardId) || []
      dashboardWidgets.push(created)
      widgets.value.set(dashboardId, dashboardWidgets)

      return created
    } catch (e) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsgv2(e as any))
      return null
    }
  }

  const duplicateWidget = async (dashboardId: string, widgetId: string) => {
    if (!activeWorkspaceId.value || !openedProject.value?.id) return null
    try {
      const created = (await $api.internal.postOperation(
        activeWorkspaceId.value,
        openedProject.value.id,
        {
          operation: 'widgetDuplicate',
        },
        {
          widgetId,
        },
      )) as WidgetType

      const dashboardWidgets = widgets.value.get(dashboardId) || []
      dashboardWidgets.push(created)
      widgets.value.set(dashboardId, dashboardWidgets)

      return created
    } catch (e) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsgv2(e as any))
      return null
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
      message.error(await extractSdkResponseErrorMsgv2(e as any))
      return null
    }
  }

  const deleteWidget = async (dashboardId: string, widgetId: string) => {
    if (!activeWorkspaceId.value || !openedProject.value?.id) return null

    try {
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

      if (selectedWidget.value?.id === widgetId) {
        selectedWidget.value = null
      }

      return true
    } catch (e) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsgv2(e as any))
      return false
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

  const loadWidgetData = async (widgetId: string) => {
    if ((!activeWorkspaceId.value || !openedProject.value?.id) && !sharedDashboardState.value?.activeProjectId) {
      return null
    }
    try {
      if (sharedDashboardState.value?.activeProjectId) {
        return await $api.public.dataWidget(activeDashboardId.value, widgetId, {
          headers: {
            'xc-password': sharedDashboardState.value?.password,
          },
        })
      }

      return await $api.internal.getOperation(activeWorkspaceId.value!, openedProject.value.id!, {
        operation: 'widgetDataGet',
        widgetId,
      })
    } catch (e) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsgv2(e as any))
      return null
    }
  }

  const handleRealtimeWidgetEvent = (payload: WidgetPayload) => {
    const { id, dashboardId, action, payload: widget } = payload
    const existingWidgets = widgets.value.get(dashboardId) || []

    switch (action) {
      case 'create': {
        const updatedWidgets = [...existingWidgets, widget]
        widgets.value.set(dashboardId, updatedWidgets)
        break
      }
      case 'update': {
        const updatedWidgets = existingWidgets.map((w) => (w.id === id ? { ...w, ...widget } : w))
        widgets.value.set(dashboardId, updatedWidgets)

        if (selectedWidget.value?.id === id) {
          selectedWidget.value = { ...selectedWidget.value, ...widget }
        }
        break
      }
      case 'delete': {
        const updatedWidgets = existingWidgets.filter((w) => w.id !== id)
        widgets.value.set(dashboardId, updatedWidgets)

        if (selectedWidget.value?.id === id) {
          selectedWidget.value = null
        }
        break
      }
    }
  }

  const setupRealtimeSubscription = (baseId: string) => {
    if (!activeWorkspaceId.value || !$ncSocket || !baseId) return

    const eventKey = `${EventType.WIDGET_EVENT}:${activeWorkspaceId.value}:${baseId}`

    $ncSocket.subscribe(eventKey)

    $ncSocket.onMessage(eventKey, (payload: WidgetPayload) => {
      if (payload.eventType === EventType.WIDGET_EVENT) {
        handleRealtimeWidgetEvent(payload as WidgetPayload)
      }
    })
  }

  watch(
    activeProjectId,
    (newBaseId, oldBaseId) => {
      if (newBaseId && newBaseId !== oldBaseId) {
        setupRealtimeSubscription(newBaseId)
      }
    },
    { immediate: true },
  )

  onUnmounted(() => {
    if (activeProjectId.value && activeWorkspaceId.value && $ncSocket) {
      const eventKey = `${EventType.WIDGET_EVENT}:${activeWorkspaceId.value}:${activeProjectId.value}`
      $ncSocket.offMessage(eventKey)
    }
  })

  return {
    // State
    widgets,

    // Getters
    activeDashboardWidgets,
    selectedWidget,

    // Actions
    loadWidgets,
    getWidget,
    createWidget,
    duplicateWidget,
    updateWidget,
    deleteWidget,
    updateWidgetPosition,
    clearWidgets,
    loadWidgetData,
  }
})

// Enable HMR
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useWidgetStore, import.meta.hot))
}
