import { acceptHMRUpdate, defineStore } from 'pinia'
import type { BaseType, OracleUi, ProjectType, ProjectUserReqType, RequestParams } from 'nocodb-sdk'
import { SqlUiFactory } from 'nocodb-sdk'
import { isString } from '@vue/shared'
import { useWorkspace } from '#imports'
import type { NcProject, User } from '#imports'

// todo: merge with project store
export const useProjects = defineStore('projectsStore', () => {
  const { $api } = useNuxtApp()

  const projects = ref<Map<string, NcProject>>(new Map())

  const projectsList = computed<NcProject[]>(() =>
    Array.from(projects.value.values()).sort((a, b) => a.updated_at - b.updated_at),
  )

  const router = useRouter()
  const route = router.currentRoute

  const activeProjectId = computed(() => {
    if (route.value.params.typeOrId === 'base') {
      return projectsList.value?.[0]?.id
    }

    return route.value.params.projectId as string | undefined
  })

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

  const workspaceStore = useWorkspace()
  const tableStore = useTablesStore()

  const { api } = useApi()

  const { getBaseUrl } = useGlobal()

  const isProjectsLoading = ref(false)

  async function getProjectUsers({
    projectId,
    limit,
    page,
    searchText,
  }: {
    projectId: string
    limit: number
    page: number
    searchText: string | undefined
  }) {
    const response: any = await api.auth.projectUserList(projectId, {
      query: {
        limit,
        offset: (page - 1) * limit,
        query: searchText,
      },
    } as RequestParams)

    const totalRows = response.users.pageInfo.totalRows ?? 0

    return {
      users: response.users.list,
      totalRows,
    }
  }

  const createProjectUser = async (projectId: string, user: User) => {
    await api.auth.projectUserAdd(projectId, user as ProjectUserReqType)
  }

  const updateProjectUser = async (projectId: string, user: User) => {
    await api.auth.projectUserUpdate(projectId, user.id, user as ProjectUserReqType)
  }

  const removeProjectUser = async (projectId: string, user: User) => {
    await api.auth.projectUserRemove(projectId, user.id)
  }

  const loadProjects = async (page: 'recent' | 'shared' | 'starred' | 'workspace' = 'recent') => {
    // if shared base then get the shared project and create a list
    if (route.value.params.typeOrId === 'base' && route.value.params.projectId) {
      const { project_id } = await $api.public.sharedBaseGet(route.value.params.projectId as string)
      const project: ProjectType = await $api.project.read(project_id)

      if (!project) return

      projects.value = [project].reduce((acc, project) => {
        acc.set(project.id!, project)
        return acc
      }, new Map())

      projects.value.set(project.id!, {
        ...(projects.value.get(project.id!) || {}),
        ...project,
        bases: [...(project.bases ?? projects.value.get(project.id!)?.bases ?? [])],
        isExpanded: route.value.params.projectId === project.id || projects.value.get(project.id!)?.isExpanded,
        isLoading: false,
      })

      return
    }

    const activeWorkspace = workspaceStore.activeWorkspace
    const workspace = workspaceStore.workspace

    if ((!page || page === 'workspace') && !workspace?.id && !activeWorkspace?.id) {
      throw new Error('Workspace not selected')
    }

    let _projects: ProjectType[] = []

    isProjectsLoading.value = true
    try {
      const { list } = await $api.project.list({
        baseURL: getBaseUrl(activeWorkspace?.id ?? workspace?.id),
      })
      _projects = list

      projects.value = _projects.reduce((acc, project) => {
        const existingProjectMeta = projects.value.get(project.id!) || {}
        acc.set(project.id!, {
          ...existingProjectMeta,
          ...project,
          isExpanded: route.value.params.projectId === project.id || projects.value.get(project.id!)?.isExpanded,
          isLoading: false,
        })
        return acc
      }, new Map())
    } catch (e) {
      console.error(e)
      message.error(e.message)
    } finally {
      isProjectsLoading.value = false
    }
  }

  function isProjectEmpty(projectId: string) {
    if (!isProjectPopulated(projectId)) return true

    const project = projects.value.get(projectId)
    if (!project) return false

    return tableStore.projectTables.get(projectId)!.length === 0

    return false
  }

  function isProjectPopulated(projectId: string) {
    const project = projects.value.get(projectId)
    if (!project) return false

    return !!(project.bases?.length && tableStore.projectTables.get(projectId))
  }

  // actions
  const loadProject = async (projectId: string, force = false) => {
    if (!force && isProjectPopulated(projectId)) return projects.value.get(projectId)

    const _project = await api.project.read(projectId)

    if (!_project) {
      await navigateTo(`/`)
      return
    }

    _project.meta = _project?.meta && typeof _project.meta === 'string' ? JSON.parse(_project.meta) : {}

    const existingProject = projects.value.get(projectId) ?? ({} as any)

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
    workspaceId?: string
    type: string
    linkedDbProjectIds?: string[]
  }) => {
    const result = await api.project.create(
      {
        title: projectPayload.title,
        linked_db_project_ids: projectPayload.linkedDbProjectIds,
      },
      {
        baseURL: getBaseUrl('nc'),
      },
    )

    await loadProjects()

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
    return await api.project.metaGet(projectId!, {})
  }

  async function setProject(projectId: string, project: NcProject) {
    projects.value.set(projectId, project)
  }

  async function clearProjects() {
    projects.value.clear()
  }

  const navigateToProject = async ({ projectId, page }: { projectId: string; page?: 'collaborators' }) => {
    if (!projectId) return

    const project = projects.value.get(projectId)
    if (!project) return

    if (page) {
      return await navigateTo(`/nc/${projectId}?page=${page}`)
    }

    await navigateTo(`/nc/${projectId}`)
  }

  onMounted(() => {
    if (!activeProjectId.value) return
    if (isProjectPopulated(activeProjectId.value)) return
    loadProject(activeProjectId.value)
  })

  const navigateToFirstProjectOrHome = async () => {
    // if active project id is deleted, navigate to first project or home page
    if (projectsList.value?.length) await navigateToProject({ projectId: projectsList.value[0].id! })
    else navigateTo('/')
  }

  const toggleStarred = async (..._args: any) => {}

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
    getProjectUsers,
    createProjectUser,
    updateProjectUser,
    navigateToProject,
    removeProjectUser,
    navigateToFirstProjectOrHome,
    toggleStarred,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useProjects as any, import.meta.hot))
}
