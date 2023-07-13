import { acceptHMRUpdate, defineStore } from 'pinia'
import type { BaseType, OracleUi, ProjectType, TableType } from 'nocodb-sdk'
import { SqlUiFactory } from 'nocodb-sdk'
import { isString } from '@vue/shared'
import { NcProjectType } from '~/utils'
import { useWorkspace } from '~/store/workspace'
import type { NcProject } from '~~/lib'

// todo: merge with project store
export const useProjects = defineStore('projectsStore', () => {
  const { $api } = useNuxtApp()

  const projects = ref<Map<string, NcProject>>(new Map())

  const projectsList = computed<NcProject[]>(() =>
    Array.from(projects.value.values()).sort((a, b) => a.updated_at - b.updated_at),
  )

  const router = useRouter()
  const route = router.currentRoute

  const activeProjectId = computed(() => route.value.params.projectId as string | undefined)

  const openedProject = computed(() => (activeProjectId.value ? projects.value.get(activeProjectId.value) : undefined))
  const openedProjectBasesMap = computed(() => {
    const basesMap = new Map<string, BaseType>()

    if (!openedProject.value) return basesMap
    if (!openedProject.value.bases) return basesMap

    for (const base of openedProject.value.bases) {
      basesMap.set(base.id!, base)
    }

    return basesMap
  })

  const roles = computed(() => openedProject.value?.project_role || openedProject.value?.workspace_role)

  const workspaceStore = useWorkspace()
  const tableStore = useTablesStore()

  const { api } = useApi()

  const { getBaseUrl } = $(useGlobal())

  const isProjectsLoading = ref(false)

  const loadProjects = async (page?: 'recent' | 'shared' | 'starred' | 'workspace') => {
    const activeWorkspace = workspaceStore.activeWorkspace
    const workspace = workspaceStore.workspace

    if ((!page || page === 'workspace') && !workspace?.id && !activeWorkspace?.id) {
      throw new Error('Workspace not selected')
    }

    let _projects: ProjectType[] = []

    isProjectsLoading.value = true
    try {
      if (activeWorkspace?.id) {
        const { list } = await $api.workspaceProject.list(activeWorkspace?.id ?? workspace?.id, {
          baseURL: getBaseUrl(activeWorkspace?.id ?? workspace?.id),
        })
        _projects = list
      } else {
        const { list } = await $api.project.list(
          page
            ? {
                query: {
                  [page]: true,
                },
                baseURL: getBaseUrl(activeWorkspace?.id ?? workspace?.id),
              }
            : {
                baseURL: getBaseUrl(activeWorkspace?.id ?? workspace?.id),
              },
        )
        _projects = list
        projects.value.clear()
      }

      for (const project of _projects) {
        projects.value.set(project.id!, {
          ...(projects.value.get(project.id!) || {}),
          ...project,
          isExpanded: route.value.params.projectId === project.id || projects.value.get(project.id!)?.isExpanded,
          isLoading: false,
        })
      }
    } catch (e) {
      console.error(e)
      message.error(e.message)
    } finally {
      isProjectsLoading.value = false
    }
  }

  function isProjectEmpty(projectId: string) {
    if (!isProjectPopulated(projectId)) return true

    const dashboardStore = useDashboardStore()
    const docsStore = useDocStore()

    const project = projects.value.get(projectId)
    if (!project) return false

    switch (project.type) {
      case NcProjectType.DB:
        return tableStore.projectTables.get(projectId)!.length === 0
      case NcProjectType.DOCS:
        return docsStore.nestedPagesOfProjects[projectId]!.length === 0
      case NcProjectType.DASHBOARD:
        return dashboardStore.layoutsOfProjects[projectId]!.length === 0
    }

    return false
  }

  function isProjectPopulated(projectId: string) {
    const dashboardStore = useDashboardStore()
    const docsStore = useDocStore()

    const project = projects.value.get(projectId)
    if (!project) return false

    switch (project.type) {
      case NcProjectType.DB:
        return !!(project.bases && tableStore.projectTables.get(projectId))
      case NcProjectType.DOCS:
        return !!docsStore.nestedPagesOfProjects[projectId]
      case NcProjectType.DASHBOARD:
        return !!dashboardStore.layoutsOfProjects[projectId]
    }
  }

  // actions
  const loadProject = async (projectId: string, force = false) => {
    if (!force && isProjectPopulated(projectId)) return projects.value.get(projectId)

    const existingProject = projects.value.get(projectId) ?? ({} as any)
    const _project = await api.project.read(projectId)
    _project.meta = typeof _project.meta === 'string' ? JSON.parse(_project.meta) : {}
    const project = {
      ...existingProject,
      ..._project,
      isExpanded: route.value.params.projectId === projectId || existingProject.isExpanded,
      // isLoading is managed by Sidebar
      isLoading: existingProject.isLoading,
    }

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
    return sqlUi as Exclude<ReturnType<(typeof SqlUiFactory)['create']>, typeof OracleUi>
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
    const result = await api.project.create(
      {
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
        //   ...(route.value.query.type === NcProjectType.COWRITER && {prompt_statement: ''}),
        // }),
      },
      {
        baseURL: getBaseUrl(projectPayload.workspaceId),
      },
    )

    const count = projects.value.size
    projects.value.set(result.id!, { ...result, isExpanded: true, isLoading: false, order: count })
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
    isProjectEmpty,
    isProjectPopulated,
    isProjectsLoading,
    activeProjectId,
    openedProject,
    openedProjectBasesMap,
    roles,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useProjects as any, import.meta.hot))
}
