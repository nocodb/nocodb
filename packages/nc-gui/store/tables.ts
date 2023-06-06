import { defineStore } from 'pinia'
import type { TableType } from 'nocodb-sdk'

export const useTablesStore = defineStore('tablesStore', () => {
  const { includeM2M } = useGlobal()
  const { api } = useApi()
  const projectsStore = useProjects()

  const projectTables = ref<Map<string, TableType[]>>(new Map())

  const loadProjectTables = async (projectId: string, force = false) => {
    const projects = projectsStore.projects
    if (!force && projectTables.value.get(projectId)) {
      return
    }

    const workspaceProject = projects.get(projectId)
    if (!workspaceProject) throw new Error('Project not found')

    const existingTables = projectTables.value.get(projectId)
    if (existingTables) {
      return
    }

    const tables = await api.dbTable.list(projectId, {
      includeM2M: includeM2M.value,
    })

    projectTables.value.set(projectId, tables.list || [])
  }

  return {
    projectTables,
    loadProjectTables,
  }
})
