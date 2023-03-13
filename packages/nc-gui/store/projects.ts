import {defineStore} from 'pinia'
import type {ProjectType, TableType} from 'nocodb-sdk'
import {OracleUi, SqlUiFactory} from "nocodb-sdk";

export const useProjects = defineStore('projectsStore', () => {
  // state
  const projects = ref<Record<string, ProjectType>>({})
  const projectTableList = ref<Record<string, TableType[]>>({})

  const {api, isLoading} = useApi()

  // actions
  const loadProject = async (projectId: string) => {
    const project = await api.project.read(projectId)
    projects.value={ ...projects.value, [projectId]: project }
  }

  const loadProjectTables = async (projectId: string) => {
    const tables = await api.dbTable.list(projectId)
    projectTableList.value = { ...projectTableList.value, [projectId]: tables.list || [] }
  }

  const getSqlUi = async (projectId: string, baseId: string) => {
    if (!projects.value[projectId])
      await loadProject(projectId)

    let sqlUi = null

    for (const base of projects.value[projectId]?.bases ?? []) {
      if (base.id === baseId) {
        sqlUi = SqlUiFactory.create({client: base.type}) as any
        break;
      }
    }
    return sqlUi as Exclude<ReturnType<typeof SqlUiFactory['create']> ,
      typeof OracleUi>
  }


  return {
    projects,
    projectTableList,
    isLoading,

    loadProject,
    loadProjectTables,
    getSqlUi
  }
})
