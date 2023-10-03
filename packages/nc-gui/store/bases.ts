import { acceptHMRUpdate, defineStore } from 'pinia'
import type { BaseType, OracleUi, ProjectUserReqType, RequestParams, SourceType } from 'nocodb-sdk'
import { SqlUiFactory } from 'nocodb-sdk'
import { isString } from '@vue/shared'
import { useWorkspace } from '#imports'
import type { NcProject, User } from '#imports'

// todo: merge with base store
export const useBases = defineStore('basesStore', () => {
  const { $api } = useNuxtApp()

  const bases = ref<Map<string, NcProject>>(new Map())

  const basesList = computed<NcProject[]>(() => Array.from(bases.value.values()).sort((a, b) => a.updated_at - b.updated_at))

  const router = useRouter()
  const route = router.currentRoute

  const activeProjectId = computed(() => {
    if (route.value.params.typeOrId === 'base') {
      return basesList.value?.[0]?.id
    }

    return route.value.params.baseId as string | undefined
  })

  const openedProject = computed(() => (activeProjectId.value ? bases.value.get(activeProjectId.value) : undefined))
  const openedProjectBasesMap = computed(() => {
    const basesMap = new Map<string, SourceType>()

    if (!openedProject.value) return basesMap
    if (!openedProject.value.sources) return basesMap

    for (const source of openedProject.value.sources) {
      basesMap.set(source.id!, source)
    }

    return basesMap
  })

  const workspaceStore = useWorkspace()
  const tableStore = useTablesStore()

  const { api } = useApi()

  const { getBaseUrl } = useGlobal()

  const isProjectsLoading = ref(false)

  async function getProjectUsers({
    baseId,
    limit,
    page,
    searchText,
  }: {
    baseId: string
    limit: number
    page: number
    searchText: string | undefined
  }) {
    const response: any = await api.auth.baseUserList(baseId, {
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

  const createProjectUser = async (baseId: string, user: User) => {
    await api.auth.baseUserAdd(baseId, user as ProjectUserReqType)
  }

  const updateProjectUser = async (baseId: string, user: User) => {
    await api.auth.baseUserUpdate(baseId, user.id, user as ProjectUserReqType)
  }

  const removeProjectUser = async (baseId: string, user: User) => {
    await api.auth.baseUserRemove(baseId, user.id)
  }

  const loadProjects = async (page: 'recent' | 'shared' | 'starred' | 'workspace' = 'recent') => {
    // if shared base then get the shared base and create a list
    if (route.value.params.typeOrId === 'base' && route.value.params.baseId) {
      const { base_id } = await $api.public.sharedBaseGet(route.value.params.baseId as string)
      const base: BaseType = await $api.base.read(base_id)

      if (!base) return

      bases.value = [base].reduce((acc, base) => {
        acc.set(base.id!, base)
        return acc
      }, new Map())

      bases.value.set(base.id!, {
        ...(bases.value.get(base.id!) || {}),
        ...base,
        sources: [...(base.sources ?? bases.value.get(base.id!)?.sources ?? [])],
        isExpanded: route.value.params.baseId === base.id || bases.value.get(base.id!)?.isExpanded,
        isLoading: false,
      })

      return
    }

    const activeWorkspace = workspaceStore.activeWorkspace
    const workspace = workspaceStore.workspace

    if ((!page || page === 'workspace') && !workspace?.id && !activeWorkspace?.id) {
      throw new Error('Workspace not selected')
    }

    let _projects: BaseType[] = []

    isProjectsLoading.value = true
    try {
      const { list } = await $api.base.list({
        baseURL: getBaseUrl(activeWorkspace?.id ?? workspace?.id),
      })
      _projects = list

      bases.value = _projects.reduce((acc, base) => {
        const existingProjectMeta = bases.value.get(base.id!) || {}
        acc.set(base.id!, {
          ...existingProjectMeta,
          ...base,
          isExpanded: route.value.params.baseId === base.id || bases.value.get(base.id!)?.isExpanded,
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

  function isProjectEmpty(baseId: string) {
    if (!isProjectPopulated(baseId)) return true

    const base = bases.value.get(baseId)
    if (!base) return false

    return tableStore.baseTables.get(baseId)!.length === 0

    return false
  }

  function isProjectPopulated(baseId: string) {
    const base = bases.value.get(baseId)
    if (!base) return false

    return !!(base.sources?.length && tableStore.baseTables.get(baseId))
  }

  // actions
  const loadProject = async (baseId: string, force = false) => {
    if (!force && isProjectPopulated(baseId)) return bases.value.get(baseId)

    const _project = await api.base.read(baseId)

    if (!_project) {
      await navigateTo(`/`)
      return
    }

    _project.meta = _project?.meta && typeof _project.meta === 'string' ? JSON.parse(_project.meta) : {}

    const existingProject = bases.value.get(baseId) ?? ({} as any)

    const base = {
      ...existingProject,
      ..._project,
      isExpanded: route.value.params.baseId === baseId || existingProject.isExpanded,
      // isLoading is managed by Sidebar
      isLoading: existingProject.isLoading,
    }

    bases.value.set(baseId, base)
  }

  const getSqlUi = async (baseId: string, sourceId: string) => {
    if (!bases.value.get(baseId)) await loadProject(baseId)

    let sqlUi = null
    const base = bases.value.get(baseId)!

    for (const source of base.sources ?? []) {
      if (source.id === sourceId) {
        sqlUi = SqlUiFactory.create({ client: source.type }) as any
        break
      }
    }
    return sqlUi as Exclude<ReturnType<(typeof SqlUiFactory)['create']>, typeof OracleUi>
  }

  const updateProject = async (baseId: string, baseUpdatePayload: BaseType) => {
    await api.base.update(baseId, baseUpdatePayload)
    // todo: update base in store
    await loadProject(baseId, true)
  }

  const createProject = async (basePayload: {
    title: string
    workspaceId?: string
    type: string
    linkedDbProjectIds?: string[]
  }) => {
    const result = await api.base.create(
      {
        title: basePayload.title,
        linked_db_project_ids: basePayload.linkedDbProjectIds,
      },
      {
        baseURL: getBaseUrl('nc'),
      },
    )

    await loadProjects()

    return result
  }

  const deleteProject = async (baseId: string) => {
    await api.base.delete(baseId)
    bases.value.delete(baseId)
    tableStore.baseTables.delete(baseId)

    await loadProjects()
  }

  const getProjectMeta = (baseId: string) => {
    const base = bases.value.get(baseId)
    if (!base) throw new Error('Base not found')

    let meta = {
      showNullAndEmptyInFilter: false,
    }
    try {
      meta = (isString(base.meta) ? JSON.parse(base.meta) : base.meta) ?? meta
    } catch {}

    return meta
  }

  async function getProjectMetaInfo(baseId: string) {
    return await api.base.metaGet(baseId!, {})
  }

  async function setProject(baseId: string, base: NcProject) {
    bases.value.set(baseId, base)
  }

  async function clearBases() {
    bases.value.clear()
  }

  const navigateToProject = async ({ baseId, page }: { baseId: string; page?: 'collaborators' }) => {
    if (!baseId) return

    const base = bases.value.get(baseId)
    if (!base) return

    if (page) {
      return await navigateTo(`/nc/${baseId}?page=${page}`)
    }

    await navigateTo(`/nc/${baseId}`)
  }

  onMounted(() => {
    if (!activeProjectId.value) return
    if (isProjectPopulated(activeProjectId.value)) return
    loadProject(activeProjectId.value)
  })

  const navigateToFirstProjectOrHome = async () => {
    // if active base id is deleted, navigate to first base or home page
    if (basesList.value?.length) await navigateToProject({ baseId: basesList.value[0].id! })
    else navigateTo('/')
  }

  const toggleStarred = async (..._args: any) => {}

  return {
    bases,
    basesList,
    loadProjects,
    loadProject,
    getSqlUi,
    updateProject,
    createProject,
    deleteProject,
    getProjectMetaInfo,
    getProjectMeta,
    setProject,
    clearBases,
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
  import.meta.hot.accept(acceptHMRUpdate(useBases as any, import.meta.hot))
}
