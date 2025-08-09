import { type DashboardPayload, EventType, type MetaPayload, type ScriptPayload, type WidgetPayload } from 'nocodb-sdk'

export const useRealtime = createSharedComposable(() => {
  const { $ncSocket, $eventBus } = useNuxtApp()

  const { user, ncNavigateTo } = useGlobal()

  const workspaceStore = useWorkspace()
  const { activeWorkspaceId, workspaces } = storeToRefs(workspaceStore)
  const basesStore = useBases()
  const { bases, basesUser } = storeToRefs(basesStore)

  const { setMeta } = useMetas()
  const { tables: _tables, baseId: activeBaseId, base } = storeToRefs(useBase())

  const tableStore = useTablesStore()
  const { loadProjectTables, navigateToTable } = tableStore
  const { baseTables, activeTableId } = storeToRefs(tableStore)

  const viewStore = useViewsStore()
  const { changeView } = viewStore
  const { viewsByTable, activeViewTitleOrId } = storeToRefs(viewStore)

  const dashboardStore = useDashboardStore()
  const { dashboards, activeDashboardId } = storeToRefs(dashboardStore)

  const { automations, activeAutomationId } = storeToRefs(useAutomationStore())
  const { widgets, selectedWidget } = storeToRefs(useWidgetStore())

  const activeBaseMetaChannel = ref<string | null>(null)
  const activeAutomationChannel = ref<string | null>(null)
  const activeDashboardChannel = ref<string | null>(null)
  const activeWidgetChannel = ref<string | null>(null)

  const handleBaseMetaEvent = (event: MetaPayload) => {
    if (event.action === 'table_create') {
      const tables = baseTables.value.get(activeBaseId.value)
      if (!tables) {
        loadProjectTables(activeBaseId.value, true)
      } else {
        tables.push(event.payload)
        baseTables.value.set(activeBaseId.value, tables)
      }
    } else if (event.action === 'table_update') {
      const updatedTable = event.payload
      const tables = baseTables.value.get(activeBaseId.value)
      if (tables) {
        const index = tables.findIndex((t) => t.id === updatedTable.id)
        if (index !== -1) {
          tables[index] = updatedTable
        }

        tables.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity))

        baseTables.value.set(activeBaseId.value, tables)
      } else {
        loadProjectTables(activeBaseId.value, true)
      }
    } else if (event.action === 'table_delete') {
      const deletedTableId = event.payload.id
      const tables = baseTables.value.get(activeBaseId.value)
      if (tables) {
        const updatedTables = tables.filter((t) => t.id !== deletedTableId)
        baseTables.value.set(activeBaseId.value, updatedTables)

        if (activeTableId.value === deletedTableId && updatedTables.length > 0 && updatedTables[0]?.id) {
          navigateToTable({
            tableId: updatedTables[0].id,
          })
        } else {
          ncNavigateTo({
            workspaceId: activeWorkspaceId.value,
            baseId: activeBaseId.value,
            tableId: undefined,
          })
        }
      } else {
        loadProjectTables(activeBaseId.value, true)
      }
    } else if (event.action === 'column_add' || event.action === 'column_update' || event.action === 'column_delete') {
      setMeta(event.payload)
      if (event.action === 'column_update') {
        $eventBus.smartsheetStoreEventBus.emit(SmartsheetStoreEvents.FIELD_UPDATE)
        $eventBus.smartsheetStoreEventBus.emit(SmartsheetStoreEvents.DATA_RELOAD)
      }
    } else if (event.action === 'view_create') {
      const views = viewsByTable.value.get(event.payload.fk_model_id) || []
      views.push(event.payload)
    } else if (event.action === 'view_update') {
      const tableViews = viewsByTable.value.get(event.payload.fk_model_id)
      const view = tableViews?.find((v) => v.id === event.payload.id)
      if (view) {
        Object.assign(view, event.payload)
        tableViews?.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity))
      }
    } else if (event.action === 'view_delete') {
      const views = viewsByTable.value.get(event.payload.fk_model_id)
      if (views) {
        if (activeViewTitleOrId.value === event.payload.id) {
          const firstView = views[0]
          if (firstView) {
            changeView({
              viewId: firstView.id || null,
              tableId: firstView.fk_model_id,
              baseId: firstView.base_id || activeBaseId.value,
            })
          }
        }

        const index = views.findIndex((v) => v.id === event.payload.id)
        if (index !== -1) {
          views.splice(index, 1)
        }
      }
    } else if (event.action === 'permission_update') {
      const { payload, baseId } = event
      if (base.value?.id === baseId) {
        base.value.permissions = payload
      }
    }
  }

  const handleScriptEvent = (payload: ScriptPayload, baseId: string) => {
    const { id, action, payload: automation } = payload
    const existingAutomations = automations.value.get(baseId) || []

    switch (action) {
      case 'create': {
        const updatedAutomations = [...existingAutomations, automation]
        automations.value.set(baseId, updatedAutomations)
        break
      }
      case 'update': {
        const updatedAutomations = existingAutomations.map((d) =>
          d.id === id ? { ...d, ...automation, _dirty: d._dirty ? +d._dirty + 1 : 1 } : d,
        )

        updatedAutomations.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity))

        automations.value.set(baseId, updatedAutomations)
        break
      }
      case 'delete': {
        const updatedAutomations = existingAutomations.filter((d) => d.id !== id)
        automations.value.set(baseId, updatedAutomations)
        if (activeAutomationId.value === id) {
          const nextAutomation = updatedAutomations[0]
          if (nextAutomation) {
            ncNavigateTo({
              workspaceId: activeWorkspaceId.value,
              baseId,
              automationId: nextAutomation.id,
            })
          } else {
            ncNavigateTo({
              workspaceId: activeWorkspaceId.value,
              baseId,
            })
          }
        }
        break
      }
    }
  }

  const handleDashboardEvent = (payload: DashboardPayload, baseId: string) => {
    const { id, action, payload: dashboard } = payload
    const existingDashboards = dashboards.value.get(baseId) || []

    switch (action) {
      case 'create': {
        const updatedDashboards = [...existingDashboards, dashboard]
        dashboards.value.set(baseId, updatedDashboards)
        break
      }
      case 'update': {
        const updatedDashboards = existingDashboards.map((d) => (d.id === id ? { ...d, ...dashboard } : d))

        updatedDashboards.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity))

        dashboards.value.set(baseId, updatedDashboards)
        break
      }
      case 'delete': {
        const updatedDashboards = existingDashboards.filter((d) => d.id !== id)
        dashboards.value.set(baseId, updatedDashboards)
        if (activeDashboardId.value === id) {
          const nextDashboard = updatedDashboards[0]
          if (nextDashboard) {
            ncNavigateTo({
              workspaceId: activeWorkspaceId.value,
              baseId,
              dashboardId: nextDashboard.id,
            })
          } else {
            ncNavigateTo({
              workspaceId: activeWorkspaceId.value,
              baseId,
            })
          }
        }
        break
      }
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

  const handleUserEvent = async (event: any) => {
    // workspace ops
    if (event.action === 'workspace_user_add') {
      const { workspace } = event.payload
      if (!workspaces.value.has(workspace.id)) {
        workspaces.value.set(workspace.id, workspace)
      }

      if (activeWorkspaceId.value === workspace.id) {
        await workspaceStore.loadCollaborators({} as any, workspace.id)
        basesStore.clearBasesUser()
      }
    } else if (event.action === 'workspace_update') {
      const updatedWorkspace = event.payload
      const workspace = workspaces.value.get(updatedWorkspace.id)
      if (workspace) {
        Object.assign(workspace, updatedWorkspace)
      }
    } else if (event.action === 'workspace_user_update') {
      const { workspaceId } = event

      if (activeWorkspaceId.value === workspaceId) {
        await workspaceStore.loadCollaborators({} as any, workspaceId)
        basesStore.clearBasesUser()
      }
    } else if (event.action === 'workspace_user_remove') {
      const { payload, workspaceId } = event

      // if current user is removed from workspace
      if (payload.fk_user_id === user.value?.id) {
        workspaces.value.delete(workspaceId)

        if (activeWorkspaceId.value === workspaceId) {
          ncNavigateTo({
            workspaceId: undefined,
            baseId: undefined,
            tableId: undefined,
          })
        }
      } else {
        if (activeWorkspaceId.value === workspaceId) {
          await workspaceStore.loadCollaborators({} as any, workspaceId)
          basesStore.clearBasesUser()
        }
      }
    }

    // base ops
    if (event.workspaceId === activeWorkspaceId.value) {
      if (event.action === 'base_user_add') {
        const { base, baseUser } = event.payload

        if (!bases.value.has(base.id)) {
          bases.value.set(base.id, base)
        }

        if (baseUser && basesUser.value.has(base.id)) {
          const baseUsers = basesUser.value.get(base.id)!
          const existingBaseUser = baseUsers.find((u) => u.id === baseUser.id)
          if (!existingBaseUser) {
            baseUsers.push(baseUser)
          } else {
            Object.assign(existingBaseUser, baseUser)
          }
        }
      } else if (event.action === 'base_update') {
        const updatedBase = event.payload
        const base = bases.value.get(updatedBase.id)
        if (base) {
          Object.assign(base, updatedBase)
        }
      } else if (event.action === 'base_user_update') {
        const { payload, baseId } = event

        $eventBus.realtimeEventBus.emit('base_user_update', { baseUser: payload, baseId })

        const baseUsers = basesUser.value.get(baseId)
        if (baseUsers) {
          const user = baseUsers.find((u) => u.id === payload.id)
          if (user) {
            Object.assign(user, payload)
          }
        }

        if (payload.id === user.value?.id && payload.roles === 'no-access') {
          bases.value.delete(payload.id)

          if (activeBaseId.value === baseId) {
            ncNavigateTo({
              workspaceId: activeWorkspaceId.value,
              baseId: undefined,
              tableId: undefined,
            })
          }
        }
      } else if (event.action === 'base_user_remove') {
        const { payload, baseId } = event

        if (payload.id === user.value?.id) {
          bases.value.delete(payload.id)

          if (activeBaseId.value === baseId) {
            ncNavigateTo({
              workspaceId: activeWorkspaceId.value,
              baseId: undefined,
              tableId: undefined,
            })
          }
        } else {
          const baseUsers = basesUser.value.get(baseId)

          if (baseUsers) {
            const user = baseUsers.find((u) => u.id === payload.id)
            if (user) {
              baseUsers.splice(baseUsers.indexOf(user), 1)
            }
          }
        }
      }
    }
  }

  watch(
    [activeWorkspaceId, activeBaseId],
    () => {
      if (user.value?.id) {
        $ncSocket.onMessage(`user:${user.value.id}`, handleUserEvent)
      }

      if (activeBaseId.value) {
        // Handle base meta events
        if (activeBaseMetaChannel.value) {
          $ncSocket.offMessage(activeBaseMetaChannel.value)
        }

        activeBaseMetaChannel.value = `${EventType.META_EVENT}:${activeWorkspaceId.value}:${activeBaseId.value}`
        $ncSocket.subscribe(activeBaseMetaChannel.value)

        $ncSocket.onMessage(activeBaseMetaChannel.value, handleBaseMetaEvent)

        // Handle automation events
        if (activeAutomationChannel.value) {
          $ncSocket.offMessage(activeAutomationChannel.value)
        }

        activeAutomationChannel.value = `${EventType.SCRIPT_EVENT}:${activeWorkspaceId.value}:${activeBaseId.value}`
        $ncSocket.subscribe(activeAutomationChannel.value)

        $ncSocket.onMessage(activeAutomationChannel.value, (payload: ScriptPayload) => {
          handleScriptEvent(payload, activeBaseId.value)
        })

        // Handle dashboard events
        if (activeDashboardChannel.value) {
          $ncSocket.offMessage(activeDashboardChannel.value)
        }

        activeDashboardChannel.value = `${EventType.DASHBOARD_EVENT}:${activeWorkspaceId.value}:${activeBaseId.value}`
        $ncSocket.subscribe(activeDashboardChannel.value)

        $ncSocket.onMessage(activeDashboardChannel.value, (payload: DashboardPayload) => {
          handleDashboardEvent(payload, activeBaseId.value)
        })

        // Handle widget events
        if (activeWidgetChannel.value) {
          $ncSocket.offMessage(activeWidgetChannel.value)
        }

        activeWidgetChannel.value = `${EventType.WIDGET_EVENT}:${activeWorkspaceId.value}:${activeBaseId.value}`
        $ncSocket.subscribe(activeWidgetChannel.value)
        $ncSocket.onMessage(activeWidgetChannel.value, (payload: WidgetPayload) => {
          handleRealtimeWidgetEvent(payload)
        })
      }
    },
    { immediate: true },
  )

  return {}
})
