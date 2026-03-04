import { EventType, PlanLimitTypes, ViewTypes, getFirstNonPersonalView, isVirtualCol } from 'nocodb-sdk'
import type {
  DashboardPayload,
  DocumentCommentPayload,
  DocumentPayload,
  MetaPayload,
  ScriptPayload,
  WidgetPayload,
  WorkflowPayload,
} from 'nocodb-sdk'
import { extensionUserPrefsManager } from '~/helpers/extensionUserPrefsManager'

export const useRealtime = createSharedComposable(() => {
  const { $ncSocket, $eventBus } = useNuxtApp()

  const { user, ncNavigateTo } = useGlobal()

  const { loadRoles } = useRoles()

  const { updateStatLimit } = useEeConfig()

  const { showInfoModal } = useNcConfirmModal()

  const { refreshCommandPalette } = useCommandPalette()

  const workspaceStore = useWorkspace()
  const { activeWorkspaceId, workspaces, teams } = storeToRefs(workspaceStore)
  const basesStore = useBases()
  const { bases, basesUser } = storeToRefs(basesStore)

  const { setMeta, getMeta, removeMeta } = useMetas()
  const { tables: _tables, baseId: activeBaseId, base } = storeToRefs(useBase())

  const tableStore = useTablesStore()
  const { loadProjectTables, navigateToTable } = tableStore
  const { baseTables, activeTableId } = storeToRefs(tableStore)

  const viewStore = useViewsStore()
  const { changeView } = viewStore
  const { viewsByTable, activeViewTitleOrId } = storeToRefs(viewStore)

  const dashboardStore = useDashboardStore()
  const { dashboards, activeDashboardId } = storeToRefs(dashboardStore)

  const scriptStore = useScriptStore()
  const { scripts, activeScriptId } = storeToRefs(scriptStore)

  const widgetStore = useWidgetStore()
  const { widgets, selectedWidget } = storeToRefs(widgetStore)

  const workflowStore = useWorkflowStore()
  const { workflows, activeWorkflowId } = storeToRefs(workflowStore)

  const documentStore = useDocumentsStore()
  const { documents, activeDocumentId, loadedParentIds, expandedDocIds } = storeToRefs(documentStore)

  const { baseExtensions, Extension } = useExtensions()

  const notificationStore = useNotification()

  const activeUserListener = ref<string | null>(null)
  const activeBaseMetaListener = ref<string | null>(null)
  const activeScriptListener = ref<string | null>(null)
  const activeWorkflowListener = ref<string | null>(null)
  const activeDashboardListener = ref<string | null>(null)
  const activeWidgetListener = ref<string | null>(null)
  const activeTeamListener = ref<string | null>(null)
  const activeDocumentListener = ref<string | null>(null)
  const activeDocCommentListener = ref<string | null>(null)

  const handleBaseMetaEvent = (event: MetaPayload) => {
    if (event.action === 'source_create') {
      const { payload } = event
      const baseId = payload.base_id
      if (baseId) {
        const baseObj = bases.value.get(baseId)
        if (baseObj) {
          baseObj.sources!.push(payload)
          loadProjectTables(baseId, true)
        }
      }
      refreshCommandPalette()
    } else if (event.action === 'source_update') {
      const { payload } = event
      const baseId = payload.base_id
      if (baseId) {
        const baseObj = bases.value.get(baseId)
        if (baseObj) {
          const sourceObj = baseObj.sources!.find((s) => s.id === payload.id)
          if (sourceObj) {
            Object.assign(sourceObj, payload)
          }
        }
      }
    } else if (event.action === 'source_delete') {
      const { payload } = event
      const baseId = payload.base_id
      if (baseId) {
        const baseObj = bases.value.get(baseId)
        if (baseObj) {
          const index = baseObj.sources!.findIndex((s) => s.id === payload.id)
          if (index !== -1) {
            baseObj.sources!.splice(index, 1)
          }
          loadProjectTables(baseId, true)
        }
      }
      refreshCommandPalette()
    } else if (event.action === 'source_meta_sync') {
      const { payload } = event
      const baseId = payload.base_id
      if (baseId) {
        loadProjectTables(baseId, true).then(() => {
          const tables = baseTables.value.get(baseId)
          for (const table of tables || []) {
            if (table.id && table.source_id === payload.source_id) {
              getMeta(baseId, table.id, true)
              break
            }
          }
          $eventBus.smartsheetStoreEventBus.emit(SmartsheetStoreEvents.FIELD_UPDATE)
          $eventBus.smartsheetStoreEventBus.emit(SmartsheetStoreEvents.DATA_RELOAD)
        })
      }
    } else if (event.action === 'table_create') {
      const eventBaseId = event.payload.base_id
      if (!eventBaseId || eventBaseId !== activeBaseId.value) return

      const tables = baseTables.value.get(eventBaseId)
      if (!tables) {
        loadProjectTables(eventBaseId, true)
      } else {
        tables.push(event.payload)
        baseTables.value.set(eventBaseId, tables)
      }
      refreshCommandPalette()
    } else if (event.action === 'table_permission_update') {
      loadProjectTables(activeBaseId.value, true)
      refreshCommandPalette()
    } else if (event.action === 'table_update') {
      const updatedTable = event.payload
      const eventBaseId = updatedTable.base_id
      if (!eventBaseId || eventBaseId !== activeBaseId.value) return

      const tables = baseTables.value.get(eventBaseId)
      if (tables) {
        const index = tables.findIndex((t) => t.id === updatedTable.id)
        if (index !== -1) {
          tables[index] = updatedTable
        }

        tables.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity))

        baseTables.value.set(eventBaseId, tables)
      } else {
        loadProjectTables(eventBaseId, true)
      }
      refreshCommandPalette()
    } else if (event.action === 'table_delete') {
      const eventBaseId = event.payload.base_id
      if (!eventBaseId || eventBaseId !== activeBaseId.value) return

      const deletedTableId = event.payload.id
      const tables = baseTables.value.get(eventBaseId)
      if (tables) {
        const updatedTables = tables.filter((t) => t.id !== deletedTableId)
        baseTables.value.set(eventBaseId, updatedTables)
        if (activeTableId.value === deletedTableId) {
          if (updatedTables.length > 0 && updatedTables[0]?.id) {
            navigateToTable({
              tableId: updatedTables[0].id,
            })
            showInfoModal({
              title: `Table no longer available`,
              content: `${event.payload.title} may have been deleted or your access removed.`,
            })
          } else {
            ncNavigateTo({
              workspaceId: activeWorkspaceId.value,
              baseId: eventBaseId,
              tableId: undefined,
            })
            showInfoModal({
              title: `Table no longer available`,
              content: `${event.payload.title} may have been deleted or your access removed.`,
            })
          }
        }
      } else {
        loadProjectTables(eventBaseId, true)
      }
      refreshCommandPalette()
    } else if (event.action === 'column_add' || event.action === 'column_update' || event.action === 'column_delete') {
      const { table, column, skipDataReload = false } = event.payload
      if (!table.base_id || table.base_id !== activeBaseId.value) return

      setMeta(table)
      if (event.action === 'column_update' || (event.action === 'column_add' && (isVirtualCol(column) || !!column?.cdf))) {
        $eventBus.smartsheetStoreEventBus.emit(SmartsheetStoreEvents.FIELD_UPDATE)
        if (!skipDataReload) $eventBus.smartsheetStoreEventBus.emit(SmartsheetStoreEvents.DATA_RELOAD)
      }
    } else if (event.action === 'view_create') {
      if (!event.payload.base_id || !event.payload.fk_model_id) return

      const key = `${event.payload.base_id}:${event.payload.fk_model_id}`
      const views = viewsByTable.value.get(key) || []

      // Check if there was a first collaborative grid view before
      const oldFirstCollabGridView = getFirstNonPersonalView(views, {
        includeViewType: ViewTypes.GRID,
      })

      views.push(event.payload)

      // Check if there's a new first collaborative grid view after adding
      const newFirstCollabGridView = getFirstNonPersonalView(views, {
        includeViewType: ViewTypes.GRID,
      })

      // If the first collaborative grid view changed, trigger getMeta
      if (newFirstCollabGridView?.id !== oldFirstCollabGridView?.id && event.payload.fk_model_id) {
        getMeta(event.payload.base_id, event.payload.fk_model_id, true)
      }

      refreshCommandPalette()
    } else if (event.action === 'view_update') {
      if (!event.payload.base_id || !event.payload.fk_model_id) return

      const key = `${event.payload.base_id}:${event.payload.fk_model_id}`
      const tableViews = viewsByTable.value.get(key)
      const view = tableViews?.find((v) => v.id === event.payload.id)
      if (view) {
        const needReload = !view?.show_system_fields && event.payload?.show_system_fields

        // Check if there was a first collaborative grid view before update
        const oldFirstCollabGridView = getFirstNonPersonalView(tableViews, {
          includeViewType: ViewTypes.GRID,
        })

        Object.assign(view, event.payload)
        tableViews?.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity))

        // Check if there's a new first collaborative grid view after update
        const newFirstCollabGridView = getFirstNonPersonalView(tableViews, {
          includeViewType: ViewTypes.GRID,
        })

        // If the first collaborative grid view changed (e.g., view changed from personal to collaborative)
        // trigger getMeta to refresh table metadata
        if (newFirstCollabGridView?.id !== oldFirstCollabGridView?.id && event.payload.fk_model_id && event.payload.base_id) {
          getMeta(event.payload.base_id, event.payload.fk_model_id, true)
        }

        if (needReload) $eventBus.smartsheetStoreEventBus.emit(SmartsheetStoreEvents.DATA_RELOAD)
        if (event.payload?.from_row_color)
          $eventBus.smartsheetStoreEventBus.emit(SmartsheetStoreEvents.ROW_COLOR_UPDATE, { viewChange: true })
      }
      refreshCommandPalette()
    } else if (event.action === 'view_delete') {
      if (!event.payload.base_id || !event.payload.fk_model_id) return

      const key = `${event.payload.base_id}:${event.payload.fk_model_id}`
      const views = viewsByTable.value.get(key)
      if (views) {
        // Check if there was a first collaborative grid view before delete
        const oldFirstCollabGridView = getFirstNonPersonalView(views, {
          includeViewType: ViewTypes.GRID,
        })

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

        // Check if there's a new first collaborative grid view after delete
        const newFirstCollabGridView = getFirstNonPersonalView(views, {
          includeViewType: ViewTypes.GRID,
        })

        // If the first collaborative grid view changed after deletion, trigger getMeta
        if (newFirstCollabGridView?.id !== oldFirstCollabGridView?.id && event.payload.fk_model_id && event.payload.base_id) {
          getMeta(event.payload.base_id, event.payload.fk_model_id, true)
        }
      }
      refreshCommandPalette()
    } else if (event.action === 'permission_update') {
      const { payload, baseId } = event
      if (base.value?.id === baseId) {
        base.value.permissions = payload
      }
    } else if (event.action === 'sort_create' || event.action === 'sort_update' || event.action === 'sort_delete') {
      $eventBus.realtimeViewMetaEventBus.emit(event.action, event.payload)
    } else if (event.action === 'filter_create' || event.action === 'filter_update' || event.action === 'filter_delete') {
      $eventBus.realtimeViewMetaEventBus.emit(event.action, event.payload)
    } else if (event.action === 'view_column_update' || event.action === 'view_column_refresh') {
      $eventBus.realtimeViewMetaEventBus.emit(event.action, event.payload)
    } else if (event.action === 'row_color_update') {
      $eventBus.smartsheetStoreEventBus.emit(SmartsheetStoreEvents.ROW_COLOR_UPDATE, { rowColorInfo: event.payload || {} })
    } else if (event.action === 'rls_policy_update') {
      const { tableId, base_id: eventBaseId } = event.payload
      if (!eventBaseId || eventBaseId !== activeBaseId.value || !tableId) return

      // Refresh table meta to pick up updated is_rls_enabled flag
      getMeta(eventBaseId, tableId, true).then((updatedMeta) => {
        if (!updatedMeta) return

        // Update sidebar table entry so shield icon reflects the change
        const tables = baseTables.value.get(eventBaseId)
        if (tables) {
          const index = tables.findIndex((t) => t.id === tableId)
          if (index !== -1) {
            tables[index] = { ...tables[index], meta: updatedMeta.meta }
            baseTables.value.set(eventBaseId, tables)
          }
        }
      })

      // If the affected table is currently open, reload its data (RLS may change visible rows)
      if (tableId === activeTableId.value) {
        $eventBus.smartsheetStoreEventBus.emit(SmartsheetStoreEvents.DATA_RELOAD)
      }
    } else if (event.action === 'extension_create') {
      updateStatLimit(PlanLimitTypes.LIMIT_EXTENSION_PER_WORKSPACE, 1)
      const { payload } = event
      if (activeBaseId.value === payload.base_id && baseExtensions.value[activeBaseId.value]) {
        const newExtension = new Extension(payload)
        baseExtensions.value[activeBaseId.value].extensions.push(newExtension)
        baseExtensions.value[activeBaseId.value].extensions.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity))
      }
    } else if (event.action === 'extension_update') {
      const { payload } = event
      if (activeBaseId.value === payload.base_id && baseExtensions.value[activeBaseId.value]) {
        const extension = baseExtensions.value[activeBaseId.value].extensions.find((ext) => ext.id === payload.id)
        if (extension) {
          extension.is_last_update_from_realtime = true
          extension.deserialize(payload)
          extension.uiKey++
        }
      }
    } else if (event.action === 'extension_delete') {
      updateStatLimit(PlanLimitTypes.LIMIT_EXTENSION_PER_WORKSPACE, -1)
      extensionUserPrefsManager.deleteExtension(event.payload.id)
      const { payload } = event
      if (activeBaseId.value === payload.base_id && baseExtensions.value[activeBaseId.value]) {
        const index = baseExtensions.value[activeBaseId.value].extensions.findIndex((ext) => ext.id === payload.id)
        if (index !== -1) {
          baseExtensions.value[activeBaseId.value].extensions.splice(index, 1)
        }
      }
    }
  }

  const handleScriptEvent = (payload: ScriptPayload, baseId: string) => {
    const { id, action, payload: script } = payload
    const existingScripts = scripts.value.get(baseId) || []

    switch (action) {
      case 'create': {
        const updatedScripts = [...existingScripts, script]
        scripts.value.set(baseId, updatedScripts)
        updateStatLimit(PlanLimitTypes.LIMIT_SCRIPT_PER_WORKSPACE, 1)
        refreshCommandPalette()

        break
      }
      case 'update': {
        const updatedScripts = existingScripts.map((d) =>
          d.id === id ? { ...d, ...script, _dirty: d._dirty ? +d._dirty + 1 : 1 } : d,
        )

        updatedScripts.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity))

        scripts.value.set(baseId, updatedScripts)
        break
      }
      case 'delete': {
        const deletedScript = existingScripts.find((d) => d.id === id)
        const updatedScripts = existingScripts.filter((d) => d.id !== id)
        scripts.value.set(baseId, updatedScripts)
        updateStatLimit(PlanLimitTypes.LIMIT_SCRIPT_PER_WORKSPACE, -1)
        refreshCommandPalette()

        if (activeScriptId.value === id) {
          const nextScript = updatedScripts[0]
          if (nextScript) {
            ncNavigateTo({
              workspaceId: activeWorkspaceId.value,
              baseId,
              scriptId: nextScript.id,
              scriptTitle: nextScript.title,
            })
            showInfoModal({
              title: `Script no longer available`,
              content: `${deletedScript?.title || 'The script'} may have been deleted or your access removed.`,
            })
          } else {
            ncNavigateTo({
              workspaceId: activeWorkspaceId.value,
              baseId,
            })
            showInfoModal({
              title: `Script no longer available`,
              content: `${deletedScript?.title || 'The script'} may have been deleted or your access removed.`,
            })
          }
        }
        break
      }
    }
  }

  const handleWorkflowEvent = (payload: WorkflowPayload, baseId: string) => {
    const { id, action, payload: workflow } = payload
    const existingWorkflows = workflows.value.get(baseId) || []

    switch (action) {
      case 'create': {
        const updatedWorkflows = [...existingWorkflows, workflow]
        workflows.value.set(baseId, updatedWorkflows)
        refreshCommandPalette()
        break
      }
      case 'update': {
        const updatedWorkflows = existingWorkflows.map((d) =>
          d.id === id ? { ...d, ...workflow, _dirty: +(d._dirty ?? 0) + 1 } : d,
        )

        updatedWorkflows.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity))
        refreshCommandPalette()

        workflows.value.set(baseId, updatedWorkflows)
        break
      }
      case 'delete': {
        const updatedWorkflows = existingWorkflows.filter((d) => d.id !== id)
        workflows.value.set(baseId, updatedWorkflows)
        refreshCommandPalette()
        if (activeWorkflowId.value === id) {
          const nextWorkflow = updatedWorkflows[0]
          if (nextWorkflow) {
            ncNavigateTo({
              workspaceId: activeWorkspaceId.value,
              baseId,
              workflowId: nextWorkflow.id,
              workflowTitle: nextWorkflow.title,
            })
            showInfoModal({
              title: `Workflow no longer available`,
              content: `${workflow.title} may have been deleted or your access removed.`,
            })
          } else {
            ncNavigateTo({
              workspaceId: activeWorkspaceId.value,
              baseId,
            })
            showInfoModal({
              title: `Workflow no longer available`,
              content: `${workflow.title} may have been deleted or your access removed.`,
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
        updateStatLimit(PlanLimitTypes.LIMIT_DASHBOARD_PER_WORKSPACE, 1)
        dashboards.value.set(baseId, updatedDashboards)
        refreshCommandPalette()
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
        updateStatLimit(PlanLimitTypes.LIMIT_DASHBOARD_PER_WORKSPACE, -1)
        dashboards.value.set(baseId, updatedDashboards)
        refreshCommandPalette()
        if (activeDashboardId.value === id) {
          const nextDashboard = updatedDashboards[0]
          if (nextDashboard) {
            ncNavigateTo({
              workspaceId: activeWorkspaceId.value,
              baseId,
              dashboardId: nextDashboard.id,
              dashboardTitle: nextDashboard.title,
            })
            showInfoModal({
              title: `Dashboard no longer available`,
              content: `${dashboard.title} may have been deleted or your access removed.`,
            })
          } else {
            ncNavigateTo({
              workspaceId: activeWorkspaceId.value,
              baseId,
            })
            showInfoModal({
              title: `Dashboard no longer available`,
              content: `${dashboard.title} may have been deleted or your access removed.`,
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

  const handleDocumentEvent = (payload: DocumentPayload, baseId: string) => {
    const { id, action, payload: doc } = payload
    const baseDocs = documents.value.get(baseId) || []

    switch (action) {
      case 'create': {
        // Guard: skip if already present (duplicate event)
        if (baseDocs.some((d) => d.id === id)) break

        // Only insert if parent's children have been loaded (lazy loading)
        const parentKey = doc.parent_id ? doc.parent_id : `root:${baseId}`
        if (!loadedParentIds.value.has(parentKey)) break

        baseDocs.push(doc)
        documents.value.set(baseId, baseDocs)

        // Update parent's has_children
        if (doc.parent_id) {
          const parent = baseDocs.find((d) => d.id === doc.parent_id)
          if (parent) parent.has_children = true
        }

        refreshCommandPalette()
        break
      }
      case 'update': {
        const existing = baseDocs.find((d) => d.id === id)
        if (existing) {
          // Patch sidebar-visible fields in place
          if (doc.title !== undefined) existing.title = doc.title
          if (doc.meta !== undefined) existing.meta = doc.meta
          if (doc.order !== undefined) existing.order = doc.order
          if (doc.version !== undefined) existing.version = doc.version
          if (doc.updated_at !== undefined) existing.updated_at = doc.updated_at
          if (doc.updated_by !== undefined) existing.updated_by = doc.updated_by

          // Re-sort by order
          baseDocs.sort((a, b) => (a.order || 0) - (b.order || 0))
          documents.value.set(baseId, baseDocs)
        }
        break
      }
      case 'delete': {
        const deletedDoc = baseDocs.find((d) => d.id === id)
        if (!deletedDoc) break

        // Collect all loaded descendants for removal (backend cascades)
        const idsToRemove = new Set<string>([id])
        const collectDescendants = (parentId: string) => {
          for (const d of baseDocs) {
            if (d.parent_id === parentId && d.id && !idsToRemove.has(d.id)) {
              idsToRemove.add(d.id)
              collectDescendants(d.id)
            }
          }
        }
        collectDescendants(id)

        // Update parent's has_children before removing
        if (deletedDoc.parent_id) {
          const parent = baseDocs.find((d) => d.id === deletedDoc.parent_id)
          if (parent) {
            const remainingSiblings = baseDocs.some((d) => d.parent_id === deletedDoc.parent_id && !idsToRemove.has(d.id!))
            parent.has_children = remainingSiblings
          }
        }

        const filtered = baseDocs.filter((d) => !idsToRemove.has(d.id!))
        documents.value.set(baseId, filtered)

        // Clean up loaded parent tracking
        for (const removedId of idsToRemove) {
          loadedParentIds.value.delete(removedId)
        }

        refreshCommandPalette()

        // Navigate away if the active doc was deleted
        if (activeDocumentId.value && idsToRemove.has(activeDocumentId.value)) {
          const nextDoc = filtered[0]
          if (nextDoc?.id) {
            ncNavigateTo({
              workspaceId: activeWorkspaceId.value,
              baseId,
              docId: nextDoc.id,
              docTitle: nextDoc.title,
            })
          } else {
            ncNavigateTo({
              workspaceId: activeWorkspaceId.value,
              baseId,
            })
          }
          showInfoModal({
            title: `Document no longer available`,
            content: `${deletedDoc.title || 'The document'} may have been deleted or your access removed.`,
          })
        }
        break
      }
      case 'move': {
        const existing = baseDocs.find((d) => d.id === id)
        if (!existing) break

        const oldParentId = payload.oldParentId ?? null

        // Update parent_id and order
        existing.parent_id = doc.parent_id
        existing.order = doc.order

        // Update new parent's has_children
        if (doc.parent_id) {
          const newParent = baseDocs.find((d) => d.id === doc.parent_id)
          if (newParent) newParent.has_children = true
        }

        // Update old parent's has_children
        if (oldParentId) {
          const oldParent = baseDocs.find((d) => d.id === oldParentId)
          if (oldParent) {
            const remainingChildren = baseDocs.some((d) => d.parent_id === oldParentId && d.id !== id)
            oldParent.has_children = remainingChildren
          }
        }

        // Re-sort by order
        baseDocs.sort((a, b) => (a.order || 0) - (b.order || 0))
        documents.value.set(baseId, baseDocs)
        break
      }
    }
  }

  const handleUserEvent = async (event: any) => {
    // Handle notification events
    if (event.event === EventType.NOTIFICATION_EVENT && event.action === 'create' && event.payload) {
      notificationStore.handleRealtimeNotification(event.payload)
      return
    }

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
      refreshCommandPalette()
    } else if (event.action === 'workspace_update') {
      const updatedWorkspace = event.payload
      const workspace = workspaces.value.get(updatedWorkspace.id)
      if (workspace) {
        Object.assign(workspace, updatedWorkspace)
      }
      refreshCommandPalette()
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
        if (activeWorkspaceId.value === workspaceId) {
          const workspace = workspaces.value.get(workspaceId)
          ncNavigateTo({
            workspaceId: undefined,
            baseId: undefined,
            tableId: undefined,
          })
          showInfoModal({
            title: `Workspace no longer available`,
            content: `${workspace?.title} may have been deleted or your access removed.`,
          })
        }

        workspaces.value.delete(workspaceId)
      } else {
        if (activeWorkspaceId.value === workspaceId) {
          await workspaceStore.loadCollaborators({} as any, workspaceId)
          basesStore.clearBasesUser()
        }
      }
      refreshCommandPalette()
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
        refreshCommandPalette()
      } else if (event.action === 'base_update') {
        const updatedBase = event.payload
        const base = bases.value.get(updatedBase.id)
        if (base) {
          Object.assign(base, updatedBase)
        }
        refreshCommandPalette()
      } else if (event.action === 'base_user_update') {
        const { payload, baseId } = event

        $eventBus.realtimeBaseUserEventBus.emit(event.action, { baseUser: payload, baseId })

        const baseUsers = basesUser.value.get(baseId)
        if (baseUsers) {
          const user = baseUsers.find((u) => u.id === payload.fk_user_id)
          if (user) {
            Object.assign(user, payload)
          }
        }

        if (payload.fk_user_id === user.value?.id) {
          if (payload.roles === 'no-access') {
            bases.value.delete(baseId)

            if (activeBaseId.value === baseId) {
              ncNavigateTo({
                workspaceId: activeWorkspaceId.value,
                baseId: undefined,
                tableId: undefined,
              })
              showInfoModal({
                title: `Base no longer available`,
                content: `${payload.title} may have been deleted or your access removed.`,
              })
            }
          } else {
            if (activeBaseId.value === baseId) {
              loadRoles(baseId).catch(() => {
                // ignore
              })
            }

            if (bases.value.has(baseId)) {
              bases.value.set(baseId, {
                ...(bases.value.get(baseId) || {}),
                project_role: payload.roles,
              })
            }
          }
        }
        refreshCommandPalette()
      } else if (event.action === 'base_user_remove') {
        const { payload, baseId } = event

        if (payload.fk_user_id === user.value?.id) {
          if (activeBaseId.value === baseId) {
            const baseTitle = bases.value.get(baseId)?.title

            ncNavigateTo({
              workspaceId: activeWorkspaceId.value,
              baseId: undefined,
              tableId: undefined,
            })
            showInfoModal({
              title: `Base no longer available`,
              content: `${baseTitle} may have been deleted or your access removed.`,
            })
          }

          bases.value.delete(baseId)
          extensionUserPrefsManager.deleteBase(baseId)
          refreshCommandPalette()
        } else {
          const baseUsers = basesUser.value.get(baseId)

          if (baseUsers) {
            const user = baseUsers.find((u) => u.id === payload.fk_user_id)
            if (user) {
              baseUsers.splice(baseUsers.indexOf(user), 1)
            }
          }
        }
      } else if (event.action === 'base_meta_reload') {
        const baseId = event.payload?.base_id
        if (baseId) {
          // Clear cached metadata only for the affected base
          const cachedTables = baseTables.value.get(baseId)
          if (cachedTables) {
            for (const table of cachedTables) {
              if (table.id) {
                removeMeta(baseId, table.id)
              }
            }
          }
          baseTables.value.delete(baseId)
          scriptStore.scripts.delete(baseId)
          workflowStore.workflows.delete(baseId)
          dashboardStore.dashboards.delete(baseId)

          // If this is the active base, reload immediately
          if (activeBaseId.value === baseId) {
            loadProjectTables(baseId, true).then(async () => {
              const tables = baseTables.value.get(baseId)
              for (const table of tables || []) {
                if (table.id) {
                  getMeta(baseId, table.id, true)
                }
              }

              await Promise.all([
                scriptStore.loadScripts({ baseId, force: true }),
                workflowStore.loadWorkflows({ baseId, force: true }),
                dashboardStore.loadDashboards({ baseId, force: true }),
              ])

              $eventBus.smartsheetStoreEventBus.emit(SmartsheetStoreEvents.FIELD_UPDATE)
              $eventBus.smartsheetStoreEventBus.emit(SmartsheetStoreEvents.DATA_RELOAD)
              refreshCommandPalette()
            })
          }
        }
      }
    }
  }

  const handleTeamEvent = async (event: any) => {
    const { id, action, payload } = event

    switch (action) {
      case 'teamCreate': {
        if (payload) {
          teams.value.push(payload)

          updateStatLimit(PlanLimitTypes.LIMIT_TEAM_MANAGEMENT, 1)
        }
        break
      }
      case 'teamUpdate': {
        if (payload) {
          teams.value = teams.value.map((team) => (team.id === id ? { ...team, ...payload } : team))
        }
        break
      }
      case 'teamDelete': {
        // Reparent children to the deleted team's parent before removing
        const deletedTeam = teams.value.find((t: any) => t.id === id)
        const parentId = (deletedTeam as any)?.fk_parent_team_id || null

        teams.value = teams.value.map((t: any) => {
          if (t.fk_parent_team_id === id) {
            return { ...t, fk_parent_team_id: parentId }
          }
          return t
        })

        teams.value = teams.value.filter((t) => t.id !== id)
        updateStatLimit(PlanLimitTypes.LIMIT_TEAM_MANAGEMENT, -1)
        break
      }
      case 'teamMove': {
        if (payload) {
          teams.value = teams.value.map((team) => (team.id === id ? { ...team, ...payload } : team))
        }
        break
      }
      case 'teamMembersAdd': {
        if (payload) {
          workspaceStore.onAddTeamMembers(id, payload)
        }
        break
      }
      case 'teamMembersRemove': {
        if (payload) {
          workspaceStore.onRemoveTeamMembers(id, payload)
        }
        break
      }
      case 'teamMembersUpdate': {
        if (payload) {
          workspaceStore.onUpdateTeamMembers(id, payload)
        }
        break
      }
    }
  }

  watch(
    [activeWorkspaceId, activeBaseId],
    () => {
      if (activeUserListener.value) {
        $ncSocket.offMessage(activeUserListener.value)
      }

      if (user.value?.id) {
        activeUserListener.value = $ncSocket.onMessage(`user:${user.value.id}`, handleUserEvent)
      }

      if (activeTeamListener.value) {
        $ncSocket.offMessage(activeTeamListener.value)
      }

      activeTeamListener.value = $ncSocket.onMessage(
        `${EventType.TEAM_EVENT}:${activeWorkspaceId.value}:${activeBaseId.value}`,
        handleTeamEvent,
      )

      if (activeBaseId.value) {
        // Handle base meta events
        if (activeBaseMetaListener.value) {
          $ncSocket.offMessage(activeBaseMetaListener.value)
        }

        activeBaseMetaListener.value = $ncSocket.onMessage(
          `${EventType.META_EVENT}:${activeWorkspaceId.value}:${activeBaseId.value}`,
          handleBaseMetaEvent,
        )

        // Handle script events
        if (activeScriptListener.value) {
          $ncSocket.offMessage(activeScriptListener.value)
        }

        activeScriptListener.value = $ncSocket.onMessage(
          `${EventType.SCRIPT_EVENT}:${activeWorkspaceId.value}:${activeBaseId.value}`,
          (payload: ScriptPayload) => {
            handleScriptEvent(payload, activeBaseId.value)
          },
        )

        // Handle workflows events
        if (activeWorkflowListener.value) {
          $ncSocket.offMessage(activeWorkflowListener.value)
        }

        activeWorkflowListener.value = $ncSocket.onMessage(
          `${EventType.WORKFLOW_EVENT}:${activeWorkspaceId.value}:${activeBaseId.value}`,
          (payload: WorkflowPayload) => {
            handleWorkflowEvent(payload, activeBaseId.value)
          },
        )

        // Handle dashboard events
        if (activeDashboardListener.value) {
          $ncSocket.offMessage(activeDashboardListener.value)
        }

        activeDashboardListener.value = $ncSocket.onMessage(
          `${EventType.DASHBOARD_EVENT}:${activeWorkspaceId.value}:${activeBaseId.value}`,
          (payload: DashboardPayload) => {
            handleDashboardEvent(payload, activeBaseId.value)
          },
        )

        // Handle widget events
        if (activeWidgetListener.value) {
          $ncSocket.offMessage(activeWidgetListener.value)
        }

        activeWidgetListener.value = $ncSocket.onMessage(
          `${EventType.WIDGET_EVENT}:${activeWorkspaceId.value}:${activeBaseId.value}`,
          (payload: WidgetPayload) => {
            handleRealtimeWidgetEvent(payload)
          },
        )

        // Handle document events
        if (activeDocumentListener.value) {
          $ncSocket.offMessage(activeDocumentListener.value)
        }

        activeDocumentListener.value = $ncSocket.onMessage(
          `${EventType.DOCUMENT_EVENT}:${activeWorkspaceId.value}:${activeBaseId.value}`,
          (payload: DocumentPayload) => {
            handleDocumentEvent(payload, activeBaseId.value)
          },
        )

        // Handle document comment events — reload comments for active document
        if (activeDocCommentListener.value) {
          $ncSocket.offMessage(activeDocCommentListener.value)
        }

        activeDocCommentListener.value = $ncSocket.onMessage(
          `${EventType.DOCUMENT_COMMENT_EVENT}:${activeWorkspaceId.value}:${activeBaseId.value}`,
          (_payload: DocumentCommentPayload) => {
            const { activeDocId, applyRealtimeEvent } = useDocumentComments()
            if (activeDocId.value && _payload.id === activeDocId.value) {
              applyRealtimeEvent(_payload.action, _payload.payload)
            }
          },
        )
      }
    },
    { immediate: true },
  )

  const unsubscribeActiveChannels = (): void => {
    ;[
      activeUserListener.value,
      activeBaseMetaListener.value,
      activeScriptListener.value,
      activeDashboardListener.value,
      activeWidgetListener.value,
      activeTeamListener.value,
      activeDocumentListener.value,
      activeDocCommentListener.value,
    ]
      .filter(Boolean)
      .forEach((channel) => {
        $ncSocket.offMessage(channel!)
      })
  }

  onBeforeUnmount(() => {
    unsubscribeActiveChannels()
  })

  return {}
})
