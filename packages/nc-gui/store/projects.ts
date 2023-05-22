import { defineStore } from 'pinia'
import type { OracleUi, ProjectType, TableType } from 'nocodb-sdk'
import { SqlUiFactory } from 'nocodb-sdk'
import { isString } from '@vueuse/core'
import { NcProjectType } from '~/utils'
import { useWorkspace } from '~/store/workspace'

// todo: merge with project store
export const useProjects = defineStore('projectsStore', () => {
  // state
  // todo: rename to projectMap
  const projects = ref<Record<string, ProjectType>>({})
  // todo: rename to projectTablesMap
  const projectTableList = ref<Record<string, TableType[]>>({})

  const { api, isLoading } = useApi()

  const worspaceStore = useWorkspace()

  const { includeM2M } = useGlobal()

  // actions
  const loadProject = async (projectId: string, force = false) => {
    if (!force && projects.value[projectId]) return projects.value[projectId]

    const project = await api.project.read(projectId)
    projects.value = { ...projects.value, [projectId]: project }
  }

  const loadProjectTables = async (projectId: string, force = false) => {
    if (!force && projectTableList.value[projectId]) return projectTableList.value[projectId]

    const tables = await api.dbTable.list(projectId, {
      includeM2M: includeM2M.value,
    })

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
    // todo: update project in store
    await loadProject(projectId, true)
  }

  const createProject = async (projectPayload: {
    title: string
    workspaceId: string
    type: string
    linkedDbProjectIds?: string[]
  }) => {
    const result = await api.project.create({
      title: projectPayload.title,
      // @ts-expect-error todo: include in swagger
      fk_workspace_id: projectPayload.workspaceId,
      type: projectPayload.type ?? NcProjectType.DB,
      linked_db_project_ids: projectPayload.linkedDbProjectIds,
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
    return result
  }

  const deleteProject = async (projectId: string) => {
    await api.project.delete(projectId)
    delete projects.value[projectId]
    delete projectTableList.value[projectId]
    await worspaceStore.loadProjects()
  }

  const getProjectMeta = (projectId: string) => {
    const project = projects.value[projectId]

    let meta = {
      showNullAndEmptyInFilter: false,
    }
    try {
      meta = (isString(project.meta) ? JSON.parse(project.meta) : project.meta) ?? meta
    } catch {}

    return meta
  }

  async function getProjectMetaInfo(projectId: string) {
    return await api.project.metaGet(projectId!, {}, {})
  }

  async function setProject(projectId: string, meta: any) {
    projects.value[projectId] = meta
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
    getProjectMetaInfo,
    getProjectMeta,
    setProject,
  }
})
