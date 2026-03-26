import type { BaseType, WorkspaceType, WorkspaceUserRoles } from 'nocodb-sdk'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { isString } from '@vue/shared'

export interface NcWorkspace extends WorkspaceType {}

export const useWorkspace = defineStore('workspaceStore', () => {
  const basesStore = useBases()

  const collaborators = ref<any[] | null>()

  const collaboratorsMap = computed(() => {
    return {}
  })

  const allCollaborators = ref<any[] | null>()

  const router = useRouter()

  const route = router.currentRoute

  const deletingWorkspace = ref(false)

  const { $api } = useNuxtApp()

  const { refreshCommandPalette } = useCommandPalette()

  const lastPopulatedWorkspaceId = ref<string | null>(null)

  const { appInfo, ncNavigateTo } = useGlobal()

  const workspaces = ref<Map<string, any>>(new Map())
  const workspacesList = computed<any[]>(() => Array.from(workspaces.value.values()).sort((a, b) => a.updated_at - b.updated_at))

  const isWorkspaceSettingsPageOpened = computed(() => wsSettingsRouteNames.has(route.value.name as string))

  const isIntegrationsPageOpened = computed(
    () =>
      route.value.name === 'index-typeOrId-integrations' ||
      (route.value.name === 'index-typeOrId-settings-page' && route.value.params.page === 'ws-integrations'),
  )

  const isTemplatesPageOpened = computed(() => false)

  const isTemplatesFeatureEnabled = computed(() => false)

  const isFeedPageOpened = computed(() => route.value.name === 'index-typeOrId-feed')

  const isSharedBase = computed(() => route.value.params.typeOrId === 'base')

  const isWorkspaceLoading = ref(true)
  const isWorkspacesLoading = ref(false)
  const isCollaboratorsLoading = ref(true)
  const isInvitingCollaborators = ref(false)
  const workspaceUserCount = ref<number | undefined>(undefined)
  const workspaceOwnerCount = ref<number | undefined>(undefined)

  const ssoLoginRequiredDlg = ref(false)

  const upgradeWsDlg = ref(false)
  const upgradeWsJobId = ref<string | null>(null)

  const removingCollaboratorMap = ref<Record<string, boolean>>({})

  const activePage = computed<'workspace' | 'recent' | 'shared' | 'starred'>(
    () => (route.value.query.page as 'workspace' | 'recent' | 'shared' | 'starred') ?? 'recent',
  )

  const activeWorkspaceId = computed(() => {
    return appInfo.value.defaultWorkspaceId || 'nc'
  })

  const activeWorkspace = computed(() => {
    return { id: activeWorkspaceId.value, title: 'default', meta: {}, roles: '' } as any
  })

  const workspaceRole = computed(() => activeWorkspace.value?.roles)

  const activeWorkspaceMeta = computed<Record<string, any>>(() => {
    const defaultMeta = {}
    if (!activeWorkspace.value) return defaultMeta
    try {
      return (
        (isString(activeWorkspace.value.meta) ? JSON.parse(activeWorkspace.value.meta) : activeWorkspace.value.meta) ??
        defaultMeta
      )
    } catch (e) {
      return defaultMeta
    }
  })

  /** actions */
  const loadWorkspaces = async (_ignoreError = false) => {}

  const createWorkspace = async (..._args: any) => {}

  const updateWorkspace = async (..._args: any) => {}

  const deleteWorkspace = async (_: string, { skipStateUpdate: __ }: { skipStateUpdate?: boolean } = {}) => {}

  const loadCollaborators = async (
    params?: { offset?: number; limit?: number; ignoreLoading?: boolean },
    workspaceId?: string,
  ) => {
    if (!params?.ignoreLoading) isCollaboratorsLoading.value = true

    try {
      const response: any = await $api.workspaceUser.list(workspaceId ?? activeWorkspaceId.value)

      if (!response) return

      allCollaborators.value = response.list
      collaborators.value = response.list
      workspaceUserCount.value = response.pageInfo?.totalRows
    } catch {
      // Silently fail if user doesn't have permission
    } finally {
      if (!params?.ignoreLoading) isCollaboratorsLoading.value = false
    }
  }

  const inviteCollaborator = async (email: string, roles: WorkspaceUserRoles, workspaceId?: string) => {
    isInvitingCollaborators.value = true
    try {
      await $api.workspaceUser.invite(workspaceId ?? activeWorkspaceId.value, { email, roles } as any)
      await loadCollaborators({} as any, workspaceId)
      basesStore.clearBasesUser()
    } finally {
      isInvitingCollaborators.value = false
    }
  }

  const removeCollaborator = async (userId: string, workspaceId?: string, _onCurrentUserLeftCallback?: () => void) => {
    if (removingCollaboratorMap.value[userId]) return
    try {
      removingCollaboratorMap.value[userId] = true
      await $api.workspaceUser.delete(workspaceId ?? activeWorkspaceId.value, userId)
      await loadCollaborators({} as any, workspaceId)
      basesStore.clearBasesUser()
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    } finally {
      delete removingCollaboratorMap.value[userId]
    }
  }

  const updateCollaborator = async (
    userId: string,
    roles: WorkspaceUserRoles,
    workspaceId?: string,
    _overrideBaseRole: boolean = false,
  ) => {
    try {
      await $api.workspaceUser.update(workspaceId ?? activeWorkspaceId.value, userId, { roles } as any)
      await loadCollaborators({} as any, workspaceId)
      basesStore.clearBasesUser()
      return true
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  const loadWorkspace = async (workspaceId?: string) => {
    if (workspaceId) {
      workspaces.value.set(workspaceId, { ...activeWorkspace.value, id: workspaceId })
    }
  }

  const moveToOrg = async (..._args: any) => {}

  async function populateWorkspace(..._args: any) {
    isWorkspaceLoading.value = true

    try {
      await basesStore.loadProjects()
    } catch (e: any) {
      console.error(e)
    } finally {
      isWorkspaceLoading.value = false
    }
  }

  watch(activePage, async (page) => {
    if (page === 'workspace') {
      return
    }
    await basesStore.loadProjects(page)
  })

  const addToFavourite = async (baseId: string) => {
    try {
      const bases = basesStore.bases
      const base = bases.get(baseId)
      if (!base) return

      // todo: update the type
      base.starred = true

      await $api.base.userMetaUpdate(
        baseId,
        {
          starred: true,
        },
        {
          baseURL: appInfo.value.baseHostName ? `https://${activeWorkspace.value?.id}.${appInfo.value.baseHostName}` : undefined,
        },
      )
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  const removeFromFavourite = async (baseId: string) => {
    try {
      const base = basesStore.bases.get(baseId)
      if (!base) return

      base.starred = false

      await $api.base.userMetaUpdate(
        baseId,
        {
          starred: false,
        },
        {
          baseURL: appInfo.value.baseHostName ? `https://${activeWorkspace.value?.id}.${appInfo.value.baseHostName}` : undefined,
        },
      )
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  const updateProjectTitle = async (base: BaseType & { edit: boolean; temp_title: string }) => {
    try {
      await $api.base.update(
        base.id!,
        { title: base.temp_title },
        {
          baseURL: appInfo.value.baseHostName ? `https://${activeWorkspace.value.id}.${appInfo.value.baseHostName}` : undefined,
        },
      )
      base.title = base.temp_title
      base.edit = false
      refreshCommandPalette()
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  const moveWorkspace = async (..._args: any) => {}

  async function saveTheme(_theme: Partial<ThemeConfig>) {
    // Not Implemented
    /* const fullTheme = {
      primaryColor: theme.value.primaryColor,
      accentColor: theme.value.accentColor,
      ..._theme,
    }

    await updateWorkspace(activeWorkspace.value!.id!, {
      meta: {
        ...activeWorkspace.value,
        theme: fullTheme,
      },
    })

    setTheme(fullTheme)

    $e('c:themes:change') */
  }

  async function clearWorkspaces() {
    await basesStore.clearBases()
    workspaces.value.clear()
  }

  const upgradeActiveWorkspace = async () => {}

  const navigateToWorkspace = async (workspaceId?: string) => {
    workspaceId = workspaceId || activeWorkspaceId.value!
    if (!workspaceId) {
      throw new Error('Workspace not selected')
    }

    ncNavigateTo({
      workspaceId,
    })
  }

  const navigateToWorkspaceSettings = async (_?: string, cmdOrCtrl?: boolean) => {
    const workspaceId = activeWorkspaceId.value
    const path = `/${workspaceId}/more`
    if (cmdOrCtrl) {
      await navigateTo(path, {
        open: navigateToBlankTargetOpenOption,
      })
    } else {
      await navigateTo(path)
    }
  }

  // Todo: write logic to navigate to integrations
  const navigateToIntegrations = async (_?: string, cmdOrCtrl?: boolean, query: Record<string, string> = {}) => {
    if (cmdOrCtrl) {
      await navigateTo(
        { path: '/nc/integrations', query },
        {
          open: navigateToBlankTargetOpenOption,
        },
      )
    } else {
      await navigateTo({ path: '/nc/integrations', query })
    }
  }

  const navigateToFeed = async (_?: string, cmdOrCtrl?: boolean, query: Record<string, string> = {}) => {
    if (cmdOrCtrl) {
      await navigateTo(
        { path: '/nc/feed', query },
        {
          open: navigateToBlankTargetOpenOption,
        },
      )
    } else {
      await navigateTo({ path: '/nc/feed', query })
    }
  }

  const navigateToTemplates = async (..._args: any[]) => {}

  function setLoadingState(isLoading = false) {
    isWorkspaceLoading.value = isLoading
  }

  const getPlanLimit = (_arg: any) => {
    return Infinity
  }

  const toggleSsoLoginRequiredDlg = (_show = !ssoLoginRequiredDlg.value) => {
    ssoLoginRequiredDlg.value = _show
  }

  /**
   * Teams section start here
   */

  const isTeamsEnabled = computed(() => false)

  const teams = ref([])

  const teamsMap = computed(() => {})

  const isTeamsLoading = ref(false)

  const editTeamDetails = ref(null)

  const createTeam = async (..._args: any[]) => {}

  const deleteTeam = async (..._args: any[]) => {}

  const updateTeam = async (..._args: any[]) => {}

  const loadTeams = async (..._args: any[]) => {}

  const getTeamById = async (..._args: any[]) => {}

  const getTeamBreadcrumb = (_teamId: string) => {
    return [] as any[]
  }

  const addTeamMembers = async (..._args: any[]) => {}

  const removeTeamMembers = async (..._args: any[]) => {}

  const updateTeamMembers = async (..._args: any[]) => {}

  /**
   * Workspace teams
   */
  const isLoadingWorkspaceTeams = ref(true)

  const workspaceTeams = ref<any[]>([])

  const workspaceTeamList = async (..._args: any[]) => {}

  const workspaceTeamGet = async (..._args: any[]) => {}

  const workspaceTeamAdd = async (..._args: any[]) => {}

  const workspaceTeamUpdate = async (..._args: any[]) => {}

  const workspaceTeamRemove = async (..._args: any[]) => {}

  /**
   * Teams section end here
   */

  return {
    loadWorkspaces,
    workspaces,
    workspacesList,
    isWorkspaceCeLocked: (_workspaceId?: string) => false,
    createWorkspace,
    deleteWorkspace,
    updateWorkspace,
    activeWorkspace,
    loadCollaborators,
    inviteCollaborator,
    removeCollaborator,
    updateCollaborator,
    collaborators,
    collaboratorsMap,
    allCollaborators,
    isInvitingCollaborators,
    isCollaboratorsLoading,
    addToFavourite,
    removeFromFavourite,
    activeWorkspaceId,
    activePage,
    updateProjectTitle,
    moveWorkspace,
    loadWorkspace,
    saveTheme,
    activeWorkspaceMeta,
    isWorkspaceLoading,
    populateWorkspace,
    clearWorkspaces,
    upgradeActiveWorkspace,
    navigateToWorkspace,
    setLoadingState,
    navigateToWorkspaceSettings,
    lastPopulatedWorkspaceId,
    isSharedBase,
    isWorkspaceSettingsPageOpened,
    workspaceUserCount,
    workspaceOwnerCount,
    getPlanLimit,
    workspaceRole,
    moveToOrg,
    navigateToFeed,
    isIntegrationsPageOpened,
    navigateToIntegrations,
    isFeedPageOpened,
    deletingWorkspace,
    isWorkspacesLoading,
    ssoLoginRequiredDlg,
    toggleSsoLoginRequiredDlg,
    upgradeWsDlg,
    upgradeWsJobId,
    removingCollaboratorMap,

    // Teams
    teams,
    teamsMap,
    isTeamsEnabled,
    isTeamsLoading,
    editTeamDetails,
    createTeam,
    deleteTeam,
    updateTeam,
    loadTeams,
    getTeamById,
    getTeamBreadcrumb,
    addTeamMembers,
    removeTeamMembers,
    updateTeamMembers,

    // Workspace Teams
    isLoadingWorkspaceTeams,
    workspaceTeams,
    workspaceTeamList,
    workspaceTeamGet,
    workspaceTeamAdd,
    workspaceTeamUpdate,
    workspaceTeamRemove,

    // Templates
    navigateToTemplates,
    isTemplatesPageOpened,
    isTemplatesFeatureEnabled,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useWorkspace as any, import.meta.hot))
}
