import { defineStore } from 'pinia'
import type { TableType } from 'nocodb-sdk'

export const useTablesStore = defineStore('tablesStore', () => {
  const { includeM2M } = useGlobal()
  const { api } = useApi()
  const projectsStore = useProjects()

  const projectTables = ref<Map<string, TableType[]>>(new Map())

  const loadProjectTables = async (projectId: string, force = false) => {
    const projects = projectsStore.projects
    if (!force && projectTables.value.get(projectId)) return projectTables.value.get(projectId)

    const workspaceProject = projects.get(projectId)
    if (!workspaceProject) throw new Error('Project not found')

    const existingTables = projectTables.value.get(projectId)
    if (existingTables) {
      if (workspaceProject.isLoading) workspaceProject.isLoading = false

      return
    }

    workspaceProject.isLoading = true
    const tables = await api.dbTable.list(projectId, {
      includeM2M: includeM2M.value,
    })

    projectTables.value.set(projectId, tables.list || [])
    workspaceProject.isLoading = false
  }

  return {
    projectTables,
    loadProjectTables,
  }
})
