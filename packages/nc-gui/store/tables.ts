import { acceptHMRUpdate, defineStore } from 'pinia'
import type { TableType } from 'nocodb-sdk'
import { useTitle } from '@vueuse/core'

export const useTablesStore = defineStore('tablesStore', () => {
  const { includeM2M, ncNavigateTo } = useGlobal()
  const { api } = useApi()
  const { $e, $api } = useNuxtApp()
  const { addUndo, defineProjectScope } = useUndoRedo()
  const { refreshCommandPalette } = useCommandPalette()

  const router = useRouter()
  const route = router.currentRoute

  const projectTables = ref<Map<string, TableType[]>>(new Map())
  const projectsStore = useProjects()
  // const projectStore = useProject()

  const workspaceStore = useWorkspace()

  const activeTableId = computed(() => route.value.params.viewId as string | undefined)

  const activeTables = computed(() => {
    if (!projectsStore) return []

    const projectId = projectsStore.activeProjectId
    if (!projectId) return []

    const tables = projectTables.value.get(projectId!)

    if (!tables) return []

    const openedProjectBasesMap = projectsStore.openedProjectBasesMap

    return tables.filter((t) => !t.base_id || openedProjectBasesMap.get(t.base_id)?.enabled)
  })

  const activeTable = computed(() => {
    if (!projectsStore) return

    const projectId = projectsStore.activeProjectId
    if (!projectId) return

    const tables = projectTables.value.get(projectId!)

    if (!tables) return

    return activeTables.value.find((t) => t.id === activeTableId.value)
  })

  watch(
    () => activeTable.value?.title,
    (title) => {
      if (projectsStore.openedProject?.type !== 'database') return

      if (!title) {
        useTitle(projectsStore.openedProject?.title)
        return
      }

      useTitle(`${projectsStore.openedProject?.title}: ${title}`)
    },
  )

  const loadProjectTables = async (projectId: string, force = false) => {
    if (!force && projectTables.value.get(projectId)) {
      return
    }

    const existingTables = projectTables.value.get(projectId)
    if (existingTables && !force) {
      return
    }

    const tables = await api.dbTable.list(projectId, {
      includeM2M: includeM2M.value,
    })

    projectTables.value.set(projectId, tables.list || [])
  }

  const addTable = (projectId: string, table: TableType) => {
    const tables = projectTables.value.get(projectId)
    if (!tables) return

    tables.push(table)
  }

  const navigateToTable = async ({
    projectId,
    tableId,
    viewTitle,
    workspaceId,
  }: {
    projectId?: string
    tableId: string
    viewTitle?: string
    workspaceId?: string
  }) => {
    const workspaceIdOrType = workspaceId ?? workspaceStore.activeWorkspaceId
    const projectIdOrBaseId = projectId ?? projectsStore.activeProjectId

    await ncNavigateTo({
      workspaceId: workspaceIdOrType,
      projectId: projectIdOrBaseId,
      tableId,
      viewId: viewTitle,
      query: route.value.query,
    })
  }

  const openTable = async (table: TableType) => {
    if (!table.project_id) return

    const projects = projectsStore.projects
    const workspaceId = workspaceStore.activeWorkspaceId

    let project = projects.get(table.project_id)
    if (!project) {
      await projectsStore.loadProject(table.project_id)
      await loadProjectTables(table.project_id)

      project = projects.get(table.project_id)
      if (!project) throw new Error('Project not found')
    }

    const { getMeta } = useMetas()

    await getMeta(table.id as string)

    // const typeOrId = (route.value.params.typeOrId as string) || 'nc'

    let workspaceIdOrType = workspaceId

    if (['nc', 'base'].includes(route.value.params.typeOrId as string)) {
      workspaceIdOrType = route.value.params.typeOrId as string
    }

    let projectIdOrBaseId = project.id

    if (['base'].includes(route.value.params.typeOrId as string)) {
      projectIdOrBaseId = route.value.params.projectId as string
    }

    ncNavigateTo({
      workspaceId: workspaceIdOrType,
      projectId: projectIdOrBaseId,
      tableId: table?.id,
    })
  }

  const updateTable = async (table: TableType, undo?: boolean) => {
    if (!table) return

    try {
      await $api.dbTable.update(table.id as string, {
        project_id: table.project_id,
        table_name: table.table_name,
        title: table.title,
      })

      await loadProjectTables(table.project_id!, true)

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
      projectTables.value.set(
        table.project_id!,
        projectTables.value.get(table.project_id!)!.map((t) => (t.id === table.id ? { ...t, ...newMeta } : t)),
      )

      // updateTab({ id: tableMeta.id }, { title: newMeta.title })

      refreshCommandPalette()

      $e('a:table:rename')
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  return {
    projectTables,
    loadProjectTables,
    addTable,
    activeTable,
    activeTables,
    openTable,
    updateTable,
    activeTableId,
    navigateToTable,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useTablesStore as any, import.meta.hot))
}
