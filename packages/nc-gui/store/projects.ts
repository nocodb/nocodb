import { defineStore } from 'pinia'
import type { OracleUi, ProjectType, TableType } from 'nocodb-sdk'
import { SqlUiFactory } from 'nocodb-sdk'
import { NcProjectType } from '~/utils'

export const useProjects = defineStore('projectsStore', () => {
  // state
  const projects = ref<Record<string, ProjectType>>({})
  const projectTableList = ref<Record<string, TableType[]>>({})

  const { api, isLoading } = useApi()

  const worspaceStore = useWorkspace();

  // actions
  const loadProject = async (projectId: string) => {
    const project = await api.project.read(projectId)
    projects.value = { ...projects.value, [projectId]: project }
  }

  const loadProjectTables = async (projectId: string) => {
    const tables = await api.dbTable.list(projectId)
    projectTableList.value = { ...projectTableList.value, [projectId]: tables.list || [] }
  }

  const getSqlUi = async (projectId: string, baseId: string) => {
    if (!projects.value[projectId]) await loadProject(projectId)

    let sqlUi = null

    for (const base of projects.value[projectId]?.bases ?? []) {
      if (base.id === baseId) {
        sqlUi = SqlUiFactory.create({ client: base.type }) as any
        break
      }
    }
    return sqlUi as Exclude<ReturnType<typeof SqlUiFactory['create']>, typeof OracleUi>
  }

  const updateProject = async (projectId: string, projectUpdatePayload: ProjectType) => {
    await api.project.update(projectId, projectUpdatePayload)
    if (!projects.value[projectId]) await loadProject(projectId)
    if (!projects.value[projectId]) return
    const project = projects.value[projectId]
    projects.value = { ...projects.value, [projectId]: { ...project, ...projectUpdatePayload } }
  }

  const createProject = async (projectPayload: { title: string; workspaceId: string; type: string }) => {
    const result = await api.project.create({
      title: projectPayload.title,
      // @ts-expect-error todo: include in swagger
      fk_workspace_id: projectPayload.workspaceId,
      type: projectPayload.type ?? NcProjectType.DB,
      // color,
      // meta: JSON.stringify({
      //   theme: {
      //     primaryColor: color,
      //     accentColor: complement.toHex8String(),
      //   },
      //   ...(route.query.type === NcProjectType.COWRITER && {prompt_statement: ''}),
      // }),
    })

    projects.value = { ...projects.value, [result.id]: result }
  }

  const deleteProject = async (projectId: string) => {
    await api.project.delete(projectId)
    delete projects.value[projectId]
    delete projectTableList.value[projectId]
    await worspaceStore.loadProjects();
  }

  return {
    projects,
    projectTableList,
    isLoading,

    loadProject,
    loadProjectTables,
    getSqlUi,
    updateProject,
    createProject,
    deleteProject,
  }
})
