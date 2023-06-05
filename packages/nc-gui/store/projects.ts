import { defineStore } from 'pinia'
import type { OracleUi, ProjectType, TableType } from 'nocodb-sdk'
import { SqlUiFactory } from 'nocodb-sdk'
import { isString } from '@vueuse/core'
import { NcProjectType } from '~/utils'
import { useWorkspace } from '~/store/workspace'
import type { NcProject } from '~~/lib'

// todo: merge with project store
export const useProjects = defineStore('projectsStore', () => {
  const { $api } = useNuxtApp()

  const projects = ref<Map<string, NcProject>>(new Map())
  const projectsList = computed<NcProject[]>(() => Array.from(projects.value.values()))

  const workspaceStore = useWorkspace()
  const tableStore = useTablesStore()

  const { api } = useApi()
  const route = useRoute()

  const loadProjects = async (page?: 'recent' | 'shared' | 'starred' | 'workspace') => {
    const activeWorkspace = workspaceStore.activeWorkspace
    const workspace = workspaceStore.workspace

    if ((!page || page === 'workspace') && !workspace?.id && !activeWorkspace?.id) {
      throw new Error('Workspace not selected')
    }

    let _projects: ProjectType[] = []
    if (activeWorkspace?.id) {
      const { list } = await $api.workspaceProject.list(activeWorkspace?.id ?? workspace?.id)
      _projects = list
    } else {
      const { list } = await $api.project.list(
        page
          ? {
              query: {
                [page]: true,
              },
            }
          : {},
      )
      _projects = list
    }

    for (const project of _projects) {
      projects.value.set(project.id!, { ...project, isExpanded: route.params.projectId === project.id, isLoading: false })
    }
  }

  // actions
  const loadProject = async (projectId: string, force = false) => {
    if (!force && projects.value.get(projectId)) return projects.value.get(projectId)

    const _project = await api.project.read(projectId)
    const project = { ..._project, isExpanded: route.params.projectId === projectId, isLoading: false }

    projects.value.set(projectId, project)
  }

  const getSqlUi = async (projectId: string, baseId: string) => {
    if (!projects.value.get(projectId)) await loadProject(projectId)

    let sqlUi = null
    const project = projects.value.get(projectId)!

    for (const base of project.bases ?? []) {
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

    projects.value.set(result.id!, { ...result, isExpanded: true, isLoading: false })
    return result
  }

  const deleteProject = async (projectId: string) => {
    await api.project.delete(projectId)
    projects.value.delete(projectId)
    tableStore.projectTables.delete(projectId)

    await loadProjects()
  }

  const getProjectMeta = (projectId: string) => {
    const project = projects.value.get(projectId)
    if (!project) throw new Error('Project not found')

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

  async function setProject(projectId: string, project: NcProject) {
    projects.value.set(projectId, project)
  }

  async function clearProjects() {
    projects.value.clear()
  }

  return {
    projects,
    projectsList,
    loadProjects,
    loadProject,
    getSqlUi,
    updateProject,
    createProject,
    deleteProject,
    getProjectMetaInfo,
    getProjectMeta,
    setProject,
    clearProjects,
  }
})
