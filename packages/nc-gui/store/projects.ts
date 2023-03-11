import { defineStore } from 'pinia'
import type { ProjectType, TableType } from 'nocodb-sdk'

export const useProjects = defineStore('projectsStore', () => {
  // state
  const projects = ref<Record<string, ProjectType>>({})
  const projectTableList = ref<Record<string, TableType[]>>({})

  const { api, isLoading } = useApi()

  // actions
  const loadProject = async (projectId: string) => {
    const project = await api.project.read(projectId)
    projects.value[projectId] = project
  }

  const loadProjectTables = async (projectId: string) => {
    const tables = await api.dbTable.list(projectId)
    projectTableList.value[projectId] = tables.list ?? []
  }

  return {
    projects,
    projectTableList,
    isLoading,

    loadProject,
    loadProjectTables,
  }
})
