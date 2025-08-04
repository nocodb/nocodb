import { EventType } from 'nocodb-sdk'

export const useRealtime = createSharedComposable(() => {
  const { $ncSocket, $eventBus } = useNuxtApp()

  const { ncNavigateTo } = useGlobal()

  const { setMeta } = useMetas()
  const { tables: _tables, baseId } = storeToRefs(useBase())
  const workspaceStore = useWorkspace()

  const tableStore = useTablesStore()
  const { loadProjectTables, navigateToTable } = tableStore
  const { baseTables, activeTableId } = storeToRefs(tableStore)

  const viewStore = useViewsStore()
  const { changeView } = viewStore
  const { viewsByTable, activeView } = storeToRefs(viewStore)

  const activeMetaChannel = ref<string | null>(null)

  watch(
    baseId,
    async () => {
      if (!baseId.value) return

      if (activeMetaChannel.value) {
        $ncSocket.offMessage(activeMetaChannel.value)
      }

      activeMetaChannel.value = `${EventType.META_EVENT}:${workspaceStore.activeWorkspaceId}:${baseId.value}`
      $ncSocket.subscribe(activeMetaChannel.value)

      $ncSocket.onMessage(activeMetaChannel.value, (event) => {
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
                workspaceId: workspaceStore.activeWorkspaceId,
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
          const view = viewsByTable.value.get(event.payload.fk_model_id)?.find((v) => v.id === event.payload.id)
          if (view) {
            Object.assign(view, event.payload)
          }
        } else if (event.action === 'view_delete') {
          const views = viewsByTable.value.get(event.payload.fk_model_id)
          if (views) {
            const index = views.findIndex((v) => v.id === event.payload.id)
            if (index !== -1) {
              views.splice(index, 1)
            }
            const firstView = views[0]
            if (firstView) {
              changeView({
                viewId: firstView.id || null,
                tableId: firstView.fk_model_id,
                baseId: firstView.base_id || baseId.value,
              })
            }
          }
        }
      })
    },
    { immediate: true },
  )

  return {}
})
