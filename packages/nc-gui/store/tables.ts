import { acceptHMRUpdate, defineStore } from 'pinia'
import type { TableType } from 'nocodb-sdk'
import type { SidebarTableNode } from '~/lib/types'
import { DlgTableCreate } from '#components'

export const useTablesStore = defineStore('tablesStore', () => {
  const { includeM2M, ncNavigateTo } = useGlobal()
  const { api } = useApi()
  const { $e, $api } = useNuxtApp()
  const { addUndo, defineProjectScope } = useUndoRedo()
  const { refreshCommandPalette } = useCommandPalette()

  const router = useRouter()
  const route = router.currentRoute

  const baseTables = ref<Map<string, SidebarTableNode[]>>(new Map())
  const basesStore = useBases()
  // const baseStore = useBase()

  const workspaceStore = useWorkspace()

  const activeTableId = computed(() => route.value.params.viewId as string | undefined)

  const activeTables = computed(() => {
    if (!basesStore) return []

    const baseId = basesStore.activeProjectId
    if (!baseId) return []

    const tables = baseTables.value.get(baseId!)

    if (!tables) return []

    const openedProjectBasesMap = basesStore.openedProjectBasesMap

    return tables.filter((t) => !t.source_id || openedProjectBasesMap.get(t.source_id)?.enabled)
  })

  const activeTable = computed(() => {
    if (!basesStore) return

    const baseId = basesStore.activeProjectId
    if (!baseId) return

    const tables = baseTables.value.get(baseId!)

    if (!tables) return

    return activeTables.value.find((t) => t.id === activeTableId.value)
  })

  const loadProjectTables = async (baseId: string, force = false) => {
    if (!force && baseTables.value.get(baseId)) {
      return
    }

    const existingTables = baseTables.value.get(baseId)
    if (existingTables && !force) {
      return
    }

    const tables = await api.dbTable.list(baseId, {
      includeM2M: includeM2M.value,
    })

    tables.list?.forEach((t) => {
      let meta = t.meta
      if (typeof meta === 'string') {
        try {
          meta = JSON.parse(meta)
        } catch (e) {
          console.error(e)
        }
      }

      if (!meta) meta = {}

      t.meta = meta
    })

    baseTables.value.set(baseId, tables.list || [])
  }

  const addTable = (baseId: string, table: TableType) => {
    const tables = baseTables.value.get(baseId)
    if (!tables) return

    tables.push(table)
  }

  const navigateToTable = async ({
    baseId,
    tableId,
    viewTitle,
    workspaceId,
  }: {
    baseId?: string
    tableId: string
    viewTitle?: string
    workspaceId?: string
  }) => {
    const workspaceIdOrType = workspaceId ?? workspaceStore.activeWorkspaceId
    const baseIdOrBaseId = baseId ?? basesStore.activeProjectId

    let query

    // Retain query params only when navigating from one table page to another.
    // Note: `viewId` refers to `tableId` in this context.
    if (route.value?.params?.viewId && tableId) {
      query = route.value.query
    }

    await ncNavigateTo({
      workspaceId: workspaceIdOrType,
      baseId: baseIdOrBaseId,
      tableId,
      viewId: viewTitle,
      query,
    })
  }

  const openTable = async (table: TableType) => {
    if (!table.base_id) return

    const bases = basesStore.bases
    const workspaceId = workspaceStore.activeWorkspaceId

    let base = bases.get(table.base_id)
    if (!base) {
      await basesStore.loadProject(table.base_id)
      await loadProjectTables(table.base_id)

      base = bases.get(table.base_id)
      if (!base) throw new Error('Base not found')
    }

    const { getMeta } = useMetas()

    await getMeta(table.id as string)

    // const typeOrId = (route.value.params.typeOrId as string) || 'nc'

    let workspaceIdOrType = workspaceId

    if (['nc', 'base'].includes(route.value.params.typeOrId as string)) {
      workspaceIdOrType = route.value.params.typeOrId as string
    }

    let baseIdOrBaseId = base.id

    if (['base'].includes(route.value.params.typeOrId as string)) {
      baseIdOrBaseId = route.value.params.baseId as string
    }

    ncNavigateTo({
      workspaceId: workspaceIdOrType,
      baseId: baseIdOrBaseId,
      tableId: table?.id,
    })
  }

  const updateTable = async (table: TableType, undo?: boolean) => {
    if (!table) return

    try {
      await $api.dbTable.update(table.id as string, {
        base_id: table.base_id,
        table_name: table.table_name,
        title: table.title,
      })

      await loadProjectTables(table.base_id!, true)

      if (!undo) {
        addUndo({
          redo: {
            fn: (t: string) => {
              table.title = t
              updateTable(table, true)
            },
            args: [table.title],
          },
          undo: {
            fn: (t: string) => {
              table.title = t
              updateTable(table, true)
            },
            args: [table.title],
          },
          scope: defineProjectScope({ model: table }),
        })
      }

      // update metas
      const newMeta = await $api.dbTable.read(table.id as string)
      baseTables.value.set(
        table.base_id!,
        baseTables.value.get(table.base_id!)!.map((t) => (t.id === table.id ? { ...t, ...newMeta } : t)),
      )

      // updateTab({ id: tableMeta.id }, { title: newMeta.title })

      refreshCommandPalette()

      $e('a:table:rename')
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  const loadTableMeta = async (tableId: string) => {
    try {
      const meta = await $api.dbTable.read(tableId as string)
      baseTables.value.set(
        meta.base_id!,
        baseTables.value.get(meta.base_id!)!.map((t) => (t.id === tableId ? { ...t, ...meta } : t)),
      )

      return meta
    } catch (e: any) {
      return null
    }
  }

  const tableUrl = ({ table, completeUrl, isSharedBase }: { table: TableType; completeUrl: boolean; isSharedBase?: boolean }) => {
    let base
    if (!isSharedBase) {
      base = basesStore.bases.get(table.base_id!)
      if (!base) return
    }

    const nuxtPageName = 'index-typeOrId-baseId-index-index-viewId-viewTitle'

    const url = router.resolve({
      name: nuxtPageName,
      params: isSharedBase
        ? {
            typeOrId: route.value.params.typeOrId,
            baseId: route.value.params.baseId,
            viewId: route.value.params.viewId,
          }
        : {
            typeOrId: workspaceStore.activeWorkspaceId,
            baseId: base?.id,
            viewId: table.id,
          },
    })

    if (completeUrl) return `${window.location.origin}/${url.href}`

    return url.href
  }

  const reloadTableMeta = async (tableId: string) => {
    const { getMeta } = useMetas()

    await getMeta(tableId, true)
  }

  function openTableCreateDialog({
    baseId,
    sourceId,
    onCloseCallback,
  }: {
    baseId?: string
    sourceId?: string
    onCloseCallback?: () => void
  }) {
    if (!sourceId || !baseId) return

    const isCreateTableOpen = ref(true)

    const { close } = useDialog(DlgTableCreate, {
      'modelValue': isCreateTableOpen,
      sourceId,
      'baseId': baseId,
      'onCreate': closeDialog,
      'onUpdate:modelValue': () => closeDialog(),
    })

    function closeDialog(table?: TableType) {
      isCreateTableOpen.value = false

      if (!table) return

      onCloseCallback?.()

      setTimeout(() => {
        const newTableDom = document.querySelector(`[data-table-id="${table.id}"]`)
        if (!newTableDom) return

        // Scroll to the table node
        newTableDom?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }, 1000)

      close(1000)
    }
  }

  return {
    baseTables,
    loadProjectTables,
    addTable,
    activeTable,
    activeTables,
    openTable,
    updateTable,
    activeTableId,
    navigateToTable,
    tableUrl,
    reloadTableMeta,
    loadTableMeta,
    openTableCreateDialog,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useTablesStore as any, import.meta.hot))
}
