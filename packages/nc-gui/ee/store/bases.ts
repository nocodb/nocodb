import { acceptHMRUpdate, defineStore } from 'pinia'
import type { BaseType, OracleUi, ProjectUserReqType, RequestParams, SourceType } from 'nocodb-sdk'
import { SqlUiFactory } from 'nocodb-sdk'
import { isString } from '@vue/shared'
import type Record from '~icons/*'

// todo: merge with base store
export const useBases = defineStore('basesStore', () => {
  const { $api, $e } = useNuxtApp()

  const { loadRoles, isUIAllowed } = useRoles()

  const { user: currentUser } = useGlobal()

  const { appInfo } = useGlobal()

  const baseRoles = ref<Record<string, any>>({})

  const bases = ref<Map<string, NcProject>>(new Map())

  const basesList = computed<NcProject[]>(() =>
    Array.from(bases.value.values()).sort(
      (a, b) => (a.order != null ? a.order : Infinity) - (b.order != null ? b.order : Infinity),
    ),
  )
  const basesUser = ref<Map<string, User[]>>(new Map())

  const router = useRouter()
  const route = router.currentRoute

  const isProjectsLoading = ref(false)
  const isProjectsLoaded = ref(false)

  const activeProjectId = computed(() => {
    if (route.value.params.typeOrId === 'base') {
      return basesList.value?.[0]?.id
    }

    return route.value.params.baseId as string | undefined
  })

  const showProjectList = ref<boolean>(route.value.params.typeOrId === 'base' ? false : !route.value.params.baseId)

  const baseHomeSearchQuery = ref<string>('')

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
      } finally {
        isProjectsLoaded.value = true
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
    } catch (e: any) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsg(e))
      throw e
    } finally {
      isProjectsLoading.value = false
      isProjectsLoaded.value = true
    }
  }

  function isProjectEmpty(baseId: string) {
    if (!isProjectPopulated(baseId)) return true

    const base = bases.value.get(baseId)
    if (!base) return false

    return tableStore.baseTables.get(baseId)!.length === 0
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

  const createProject = async (basePayload: { title: string; workspaceId: string; meta?: Record<string, unknown> }) => {
    const result = await api.base.create(
      {
        title: basePayload.title,
        fk_workspace_id: basePayload.workspaceId,
        type: NcProjectType.DB,
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

  const navigateToProject = async ({ baseId }: { baseId: string }) => {
    if (!baseId) return

    const base = bases.value.get(baseId)
    if (!base) return

    return _navigateToProject({ workspaceId: base.fk_workspace_id, baseId })
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

  watch(
    () => route.value.params.baseId,
    () => {
      baseHomeSearchQuery.value = ''
    },
  )

  /**
   * Will have to show base home page sidebar if any base/table/view/script is active
   */
  watch(
    [
      () => route.value.params.baseId,
      () => route.value.params.viewId,
      () => route.value.params.viewTitle,
      () => route.value.params.automationId,
      () => basesList.value.length,
    ],
    (
      [newBaseId, newTableId, newViewId, newAutomationId, newBasesListLength],
      [oldBaseId, oldTableId, oldViewId, oldAutomationId],
    ) => {
      const shouldShowProjectList =
        !newBasesListLength ||
        !(
          (newBaseId && newBaseId !== oldBaseId) ||
          newTableId !== oldTableId ||
          newViewId !== oldViewId ||
          newAutomationId !== oldAutomationId
        )

      if (!showProjectList.value && shouldShowProjectList) {
        showProjectList.value = shouldShowProjectList
        return
      }

      showProjectList.value = shouldShowProjectList
    },
  )

  watch(activeProjectId, () => {
    ncLastVisitedBase().set(activeProjectId.value)
  })

  const getBaseRoles = async (baseId: string) => {
    if (baseRoles.value[baseId]) return baseRoles.value[baseId]

    const user = await loadRoles(baseId, {
      skipUpdatingUser: true,
    })

    if (user) {
      baseRoles.value[baseId] = {
        roles: user.base_roles || user.workspace_roles || {},
      }
    }

    return baseRoles.value[baseId]
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
    isProjectsLoaded,
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
    baseHomeSearchQuery,
    getBaseRoles,
    baseRoles,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useBases as any, import.meta.hot))
}
