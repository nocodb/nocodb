import { EventType } from 'nocodb-sdk'

export const useRealtime = createSharedComposable(() => {
  const { $ncSocket, $eventBus } = useNuxtApp()

  const { ncNavigateTo } = useGlobal()

  const workspaceStore = useWorkspace()
  const { activeWorkspaceId } = storeToRefs(workspaceStore)
  const { bases } = storeToRefs(useBases())

  const { setMeta } = useMetas()
  const { tables: _tables, baseId } = storeToRefs(useBase())

  const tableStore = useTablesStore()
  const { loadProjectTables, navigateToTable } = tableStore
  const { baseTables, activeTableId } = storeToRefs(tableStore)

  const viewStore = useViewsStore()
  const { changeView } = viewStore
  const { viewsByTable, activeViewTitleOrId } = storeToRefs(viewStore)

  const activeWorkspaceMetaChannel = ref<string | null>(null)
  const activeBaseMetaChannel = ref<string | null>(null)

  watch(
    [activeWorkspaceId, baseId],
    () => {
      if (activeWorkspaceId.value) {
        if (activeWorkspaceMetaChannel.value) {
          $ncSocket.offMessage(activeWorkspaceMetaChannel.value)
        }

        activeWorkspaceMetaChannel.value = `${EventType.META_EVENT}:${activeWorkspaceId.value}`
        $ncSocket.subscribe(activeWorkspaceMetaChannel.value)

        $ncSocket.onMessage(activeWorkspaceMetaChannel.value, (event) => {
          if (event.action === 'base_create') {
            bases.value.set(event.payload.id, event.payload)
          } else if (event.action === 'base_update') {
            const updatedBase = event.payload
            const base = bases.value.get(updatedBase.id)
            if (base) {
              Object.assign(base, updatedBase)
            }
          } else if (event.action === 'base_delete') {
            const deletedBaseId = event.payload.id
            bases.value.delete(deletedBaseId)

            if (baseId.value === deletedBaseId) {
              ncNavigateTo({
                workspaceId: activeWorkspaceId.value,
                baseId: undefined,
                tableId: undefined,
              })
            }
          }
        })
      }

      if (baseId.value) {
        if (activeBaseMetaChannel.value) {
          $ncSocket.offMessage(activeBaseMetaChannel.value)
        }

        activeBaseMetaChannel.value = `${EventType.META_EVENT}:${activeWorkspaceId.value}:${baseId.value}`
        $ncSocket.subscribe(activeBaseMetaChannel.value)

        $ncSocket.onMessage(activeBaseMetaChannel.value, (event) => {
          if (event.action === 'table_create') {
            const tables = baseTables.value.get(baseId.value)
            if (!tables) {
              loadProjectTables(baseId.value, true)
            } else {
              tables.push(event.payload)
              baseTables.value.set(baseId.value, tables)
            }
          } else if (event.action === 'table_update') {
            const updatedTable = event.payload
            const tables = baseTables.value.get(baseId.value)
            if (tables) {
              const index = tables.findIndex((t) => t.id === updatedTable.id)
              if (index !== -1) {
                tables[index] = updatedTable
              }

              tables.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity))

              baseTables.value.set(baseId.value, tables)
            } else {
              loadProjectTables(baseId.value, true)
            }
          } else if (event.action === 'table_delete') {
            const deletedTableId = event.payload.id
            const tables = baseTables.value.get(baseId.value)
            if (tables) {
              const updatedTables = tables.filter((t) => t.id !== deletedTableId)
              baseTables.value.set(baseId.value, updatedTables)

              if (activeTableId.value === deletedTableId && updatedTables.length > 0 && updatedTables[0]?.id) {
                navigateToTable({
                  tableId: updatedTables[0].id,
                })
              } else {
                ncNavigateTo({
                  workspaceId: activeWorkspaceId.value,
                  baseId: baseId.value,
                  tableId: undefined,
                })
              }
            } else {
              loadProjectTables(baseId.value, true)
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
                    baseId: firstView.base_id || baseId.value,
                  })
                }
              }

              const index = views.findIndex((v) => v.id === event.payload.id)
              if (index !== -1) {
                views.splice(index, 1)
              }
            }
          }
        })
      }
    },
    { immediate: true },
  )

  return {}
})
