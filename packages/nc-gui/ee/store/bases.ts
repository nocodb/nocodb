import { acceptHMRUpdate, defineStore } from 'pinia'
import type { BaseType, OracleUi, ProjectUserReqType, RequestParams, SourceType } from 'nocodb-sdk'
import { SqlUiFactory } from 'nocodb-sdk'
import { isString } from '@vue/shared'

// todo: merge with base store
export const useBases = defineStore('basesStore', () => {
  const { $api, $e } = useNuxtApp()

  const { loadRoles, isUIAllowed } = useRoles()

  const { user: currentUser } = useGlobal()

  const { appInfo } = useGlobal()

  const bases = ref<Map<string, NcProject>>(new Map())

  const basesList = computed<NcProject[]>(() =>
    Array.from(bases.value.values()).sort(
      (a, b) => (a.order != null ? a.order : Infinity) - (b.order != null ? b.order : Infinity),
    ),
  )
  const basesUser = ref<Map<string, User[]>>(new Map())

  const router = useRouter()
  const route = router.currentRoute

  const activeProjectId = computed(() => {
    if (route.value.params.typeOrId === 'base') {
      return basesList.value?.[0]?.id
    }

    return route.value.params.baseId as string | undefined
  })

  const showProjectList = ref<boolean>(!activeProjectId.value)

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

  const isDataSourceLimitReached = computed(() => Number(openedProject.value?.sources?.length) > 9)

  const workspaceStore = useWorkspace()
  const tableStore = useTablesStore()

  const { api } = useApi()

  const { getBaseUrl, navigateToProject: _navigateToProject } = useGlobal()

  const isProjectsLoading = ref(false)

  async function getBaseUsers({ baseId, searchText, force = false }: { baseId: string; searchText?: string; force?: boolean }) {
    if (!baseId) return { users: [], totalRows: 0 }

    if (!force && basesUser.value.has(baseId)) {
      const users = basesUser.value.get(baseId)
      return {
        users,
        totalRows: users?.length ?? 0,
      }
    }

    const response: any = await api.auth.baseUserList(baseId, {
      query: {
        query: searchText,
      },
    } as RequestParams)

    const totalRows = response.users.pageInfo.totalRows ?? 0

    basesUser.value.set(baseId, response.users.list)

    return {
      users: response.users.list,
      totalRows,
    }
  }

  const clearBasesUser = () => {
    basesUser.value.clear()
  }

  const createProjectUser = async (baseId: string, user: User) => {
    await api.auth.baseUserAdd(baseId, user as ProjectUserReqType)
  }

  const updateProjectUser = async (baseId: string, user: User) => {
    await api.auth.baseUserUpdate(baseId, user.id, user as ProjectUserReqType)

    // reload roles if updating roles of current user
    if (user.id === currentUser.value?.id) {
      loadRoles(baseId).catch(() => {
        // ignore
      })
    }
  }

  const removeProjectUser = async (baseId: string, user: User) => {
    await api.auth.baseUserRemove(baseId, user.id)
  }

  const loadProjects = async (page?: 'recent' | 'shared' | 'starred' | 'workspace', workspaceId?: string) => {
    // if shared source then get the shared base and create a list
    if (route.value.params.typeOrId === 'base' && route.value.params.baseId) {
      try {
        const baseMeta = await $api.public.sharedBaseGet(route.value.params.baseId as string)
        if (!baseMeta?.base_id) return

        const base: BaseType = await $api.base.read(baseMeta.base_id)

        if (!base) return

        // Set workspace info if present
        if (baseMeta?.workspace) {
          workspaceStore.workspaces.set(baseMeta.workspace.id, baseMeta.workspace)
        }

        bases.value = [base].reduce((acc, base) => {
          acc.set(base.id!, base)
          return acc
        }, new Map())

        bases.value.set(base.id!, {
          ...(bases.value.get(base.id!) || {}),
          ...base,
          isExpanded: true,
          isLoading: false,
        })

        return
      } catch (e: any) {
        if (e?.response?.status === 404) {
          return router.push('/error/404')
        }
        throw e
      }
    }

    const activeWorkspace = workspaceStore.activeWorkspace
    const workspace = workspaceStore.workspace
    const targetWorkspaceId = workspaceId ?? activeWorkspace?.id ?? workspace?.id

    if ((!page || page === 'workspace') && !targetWorkspaceId) {
      throw new Error('Workspace not selected')
    }

    let _projects: BaseType[] = []

    isProjectsLoading.value = true
    try {
      if (targetWorkspaceId) {
        const { list } = await $api.workspaceBase.list(targetWorkspaceId, {
          baseURL: getBaseUrl(targetWorkspaceId),
        })
        _projects = list
      } else {
        const { list } = await $api.base.list(
          page
            ? {
                query: {
                  [page]: true,
                },
                baseURL: getBaseUrl(targetWorkspaceId),
              }
            : {
                baseURL: getBaseUrl(targetWorkspaceId),
              },
        )
        _projects = list
      }

      // Only update bases.value if the workspaceId matches activeWorkspace.id
      if (!workspaceId || workspaceId === activeWorkspace?.id) {
        bases.value = _projects.reduce((acc, base) => {
          const existingProjectMeta = bases.value.get(base.id!) || {}
          acc.set(base.id!, {
            ...existingProjectMeta,
            ...base,
            sources: [...(base.sources ?? bases.value.get(base.id!)?.sources ?? [])],
            isExpanded: route.value.params.baseId === base.id || bases.value.get(base.id!)?.isExpanded,
            isLoading: false,
          })
          return acc
        }, new Map())

        await updateIfBaseOrderIsNullOrDuplicate()
      }

      return _projects
    } catch (e) {
      console.error(e)
      message.error(e.message)
      throw e
    } finally {
      isProjectsLoading.value = false
    }
  }

  function isProjectEmpty(baseId: string) {
    if (!isProjectPopulated(baseId)) return true

    const dashboardStore = useDashboardStore()
    const docsStore = useDocStore()

    const base = bases.value.get(baseId)
    if (!base) return false

    switch (base.type) {
      case NcProjectType.DB:
        return tableStore.baseTables.get(baseId)!.length === 0
      case NcProjectType.DOCS:
        return docsStore.nestedPagesOfProjects[baseId]!.length === 0
      case NcProjectType.DASHBOARD:
        return dashboardStore.layoutsOfProjects[baseId]!.length === 0
    }

    return false
  }

  function isProjectPopulated(baseId: string) {
    const dashboardStore = useDashboardStore()
    const docsStore = useDocStore()

    const base = bases.value.get(baseId)
    if (!base) return false

    switch (base.type) {
      case NcProjectType.DB:
        return !!(base.sources?.length && tableStore.baseTables.get(baseId))
      case NcProjectType.DOCS:
        return !!docsStore.nestedPagesOfProjects[baseId]
      case NcProjectType.DASHBOARD:
        return !!dashboardStore.layoutsOfProjects[baseId]
    }
  }

  // actions
  const loadProject = async (baseId: string, force = false) => {
    if (!force && isProjectPopulated(baseId)) return bases.value.get(baseId)

    const _project = await api.base.read(baseId)

    if (!_project) {
      await navigateTo(`/`)
      return
    }

    const existingProject = bases.value.get(baseId) ?? ({} as any)
    const base = {
      ...existingProject,
      ..._project,
      isExpanded: route.value.params.baseId === baseId || existingProject.isExpanded,
      // isLoading is managed by Sidebar
      isLoading: existingProject.isLoading,
      meta: { ...parseProp(existingProject.meta), ...parseProp(_project.meta) },
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
    const existingProject = bases.value.get(baseId) ?? ({} as any)

    const base = {
      ...existingProject,
      ...baseUpdatePayload,
    }

    bases.value.set(baseId, { ...base, meta: parseProp(base.meta) })

    await api.base.update(baseId, baseUpdatePayload)

    await loadProject(baseId, true)
  }

  const createProject = async (basePayload: {
    title: string
    workspaceId: string
    type: string
    linkedDbProjectIds?: string[]
    meta?: Record<string, unknown>
  }) => {
    const result = await api.base.create(
      {
        title: basePayload.title,
        // @ts-expect-error todo: include in swagger
        fk_workspace_id: basePayload.workspaceId,
        type: basePayload.type ?? NcProjectType.DB,
        linked_db_project_ids: basePayload.linkedDbProjectIds,
        // color,
        meta: JSON.stringify({
          ...(basePayload.meta || {}),
        }),
      },
      {
        baseURL: getBaseUrl(basePayload.workspaceId),
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
    return await api.base.metaGet(baseId!, {}, {})
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
      return await _navigateToProject({ workspaceId: base.fk_workspace_id, baseId, query: { page } })
    }

    return await _navigateToProject({ workspaceId: base.fk_workspace_id, baseId })
  }

  const toggleStarred = async (baseId: string) => {
    try {
      const activeWorkspace = workspaceStore.activeWorkspace
      const base = bases.value.get(baseId)
      if (!base) return

      base.starred = !base.starred

      await $api.base.userMetaUpdate(
        baseId,
        {
          starred: base.starred,
        },
        {
          baseURL: appInfo.value.baseHostName ? `https://${activeWorkspace?.id}.${appInfo.value.baseHostName}` : undefined,
        },
      )

      $e('a:base:star:toggle')
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  onMounted(() => {
    if (!activeProjectId.value) return
    if (isProjectPopulated(activeProjectId.value)) return
    loadProject(activeProjectId.value)
    loadRoles(activeProjectId.value)
  })

  const navigateToFirstProjectOrHome = async () => {
    // if active base id is deleted, navigate to first base or home page
    if (basesList.value?.length)
      await _navigateToProject({ baseId: basesList.value[0].id!, workspaceId: basesList.value[0].fk_workspace_id })
    else
      await _navigateToProject({
        workspaceId: workspaceStore.activeWorkspaceId,
      })
  }

  async function updateIfBaseOrderIsNullOrDuplicate() {
    if (!isUIAllowed('baseReorder')) return

    const basesArray = Array.from(bases.value.values())

    const baseOrderSet = new Set()
    let hasNullOrDuplicates = false

    // Check if basesArray contains null or duplicate order
    for (const base of basesArray) {
      if (base.order === null || baseOrderSet.has(base.order)) {
        hasNullOrDuplicates = true
        break
      }
      baseOrderSet.add(base.order)
    }

    if (!hasNullOrDuplicates) return

    // update the local state and return updated bases payload
    const updatedBasesOrder = basesArray.map((base, i) => {
      bases.value.set(base.id!, { ...base, order: i + 1 })

      return {
        id: base.id,
        order: i + 1,
      }
    })

    try {
      await Promise.all(
        updatedBasesOrder.map(async (base) => {
          await api.base.update(base.id!, { order: base.order })
        }),
      )
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

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
    getBaseUsers,
    createProjectUser,
    updateProjectUser,
    removeProjectUser,
    navigateToProject,
    navigateToFirstProjectOrHome,
    toggleStarred,
    basesUser,
    clearBasesUser,
    isDataSourceLimitReached,
    showProjectList,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useBases as any, import.meta.hot))
}
