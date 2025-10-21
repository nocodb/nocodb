import type {
  Api,
  BaseType,
  IntegrationType,
  PlanFeatureTypes,
  PlanLimitTypes,
  TeamDetailV3V3Type,
  TeamMembersAddV3ReqV3Type,
  TeamMembersRemoveV3ReqV3Type,
  TeamMembersUpdateV3ReqV3Type,
  TeamMemberV3ResponseV3Type,
  TeamUpdateV3ReqV3Type,
  TeamV3V3Type,
  WorkspaceType,
  WorkspaceUserType,
} from 'nocodb-sdk'
import { WorkspaceStatus, WorkspaceUserRoles } from 'nocodb-sdk'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { isString } from '@vue/shared'

export interface NcWorkspace extends WorkspaceType {
  edit?: boolean
  temp_title?: string | null
  roles?: string
  payment?: {
    plan: {
      title: string
      limit: { [key in PlanLimitTypes]: number }
      features: { [key in PlanFeatureTypes]: boolean }
      meta: { [key in PlanLimitTypes]: number } & {
        [key in PlanFeatureTypes]: boolean
      }
    }
  }
  stats?: { [key in PlanLimitTypes]: number }
  grace_period_start_at?: string | null
  stripe_customer_id?: string
  segment_code?: number
}

export const useWorkspace = defineStore('workspaceStore', () => {
  // todo: update type in swagger
  const basesStore = useBases()

  const workspaceStore = useWorkspace()

  const deletingWorkspace = ref(false)

  const ssoLoginRequiredDlg = ref(false)

  const { loadRoles, isUIAllowed } = useRoles()

  const { user: currentUser } = useGlobal()

  const collaborators = ref<WorkspaceUserType[] | null>()

  const collaboratorsMap = computed(() => {
    return (collaborators.value || [])?.reduce((acc, curr) => {
      if (curr.email) {
        acc[curr.email] = curr
      }

      if (curr.fk_user_id) {
        acc[curr.fk_user_id] = curr
      }

      return acc
    }, {} as Record<string, WorkspaceUserType>)
  })

  const allCollaborators = ref<WorkspaceUserType[] | null>()

  const lastPopulatedWorkspaceId = ref<string | null>(null)

  const router = useRouter()

  const route = router.currentRoute

  const { $api } = useNuxtApp()

  const { refreshCommandPalette } = useCommandPalette()

  const { $e } = useNuxtApp()

  const { appInfo, ncNavigateTo, lastOpenedWorkspaceId, storage } = useGlobal()

  const nocoAi = useNocoAi()

  const workspaceUserCount = ref<number | undefined>(undefined)

  const workspaceOwnerCount = ref<number | undefined>(undefined)

  const isSharedBase = computed(() => route.value.params.typeOrId === 'base')

  const isWorkspaceSettingsPageOpened = computed(() => route.value.name === 'index-typeOrId-settings')

  const isIntegrationsPageOpened = computed(() => route.value.name === 'index-typeOrId-integrations')

  const isFeedPageOpened = computed(() => route.value.name === 'index-typeOrId-feed')

  const workspaces = ref<Map<string, NcWorkspace>>(new Map())
  const workspacesList = computed<NcWorkspace[]>(() =>
    Array.from(workspaces.value.values()).sort((a, b) => a.updated_at - b.updated_at),
  )

  const isWorkspaceLoading = ref(true)
  const isWorkspacesLoading = ref(true)
  const isCollaboratorsLoading = ref(true)
  const isInvitingCollaborators = ref(false)

  const upgradeWsDlg = ref(false)
  const upgradeWsJobId = ref<string | null>(null)

  const removingCollaboratorMap = ref<Record<string, boolean>>({})

  const activePage = computed<'workspace' | 'recent' | 'shared' | 'starred'>(
    () => (route.value.query.page as 'workspace' | 'recent' | 'shared' | 'starred') ?? 'workspace',
  )

  const activeWorkspaceId = computed(() => {
    if (route.value.query.workspaceId) return route.value.query.workspaceId as string

    if (route.value.params.typeOrId) return route.value.params.typeOrId as string

    if (route.value.params.workspaceId) return route.value.params.workspaceId as string

    const lastLoadedWorkspace = workspacesList.value.find((w) => w.id === lastOpenedWorkspaceId.value)
    if (lastLoadedWorkspace) return lastLoadedWorkspace.id

    return workspacesList.value?.[0]?.id
  })

  const activeWorkspace = computed(() => {
    if (activeWorkspaceId.value && workspaces.value?.has(activeWorkspaceId.value)) {
      const ws = workspaces.value.get(activeWorkspaceId.value)
      if (ws) {
        return ws
      }
    }
    return activePage.value === 'workspace' ? workspacesList.value?.[0] ?? null : null
  })

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
  const loadWorkspaces = async (ignoreError = false) => {
    try {
      // todo: pagination
      const { list, pageInfo: _ } = await $api.workspace.list()

      const newWorkspaceIds = new Set(list?.map((w) => w.id) ?? [])

      // Update or insert current workspaces
      for (const workspace of list ?? []) {
        const oldData = workspaces.value.has(workspace.id!) ? workspaces.value.get(workspace.id!) : {}
        workspaces.value.set(workspace.id!, {
          ...oldData,
          ...workspace,
        })
      }

      // Remove stale workspaces
      for (const existingId of workspaces.value.keys()) {
        if (!newWorkspaceIds.has(existingId)) {
          workspaces.value.delete(existingId)
        }
      }

      isWorkspacesLoading.value = false

      return list
    } catch (e: any) {
      if (!ignoreError) message.error(await e)
    }
  }

  const createWorkspace = async (workspace: Pick<WorkspaceType, 'title' | 'order' | 'description' | 'meta' | 'fk_org_id'>) => {
    try {
      let reqPayload

      if (workspace.title!.includes(',')) {
        reqPayload = workspace
          .title!.split(',')
          .filter((t) => t.trim())
          .map((title) => {
            // pick a random color from array and assign to workspace
            const color = baseThemeColors[Math.floor(Math.random() * 1000) % baseThemeColors.length]
            return { ...workspace, title, meta: { color, icon: '', iconType: '' } }
          })
      } else {
        // pick a random color from array and assign to workspace
        const color = baseThemeColors[Math.floor(Math.random() * 1000) % baseThemeColors.length]
        reqPayload = { ...workspace, meta: { color, icon: '', iconType: '' } }
      }

      // todo: pagination
      const workspaceRes = await $api.workspace.create(reqPayload)
      refreshCommandPalette()
      return workspaceRes
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  const updateWorkspace = async (
    workspaceId: string,
    workspaceData: Pick<WorkspaceType, 'title' | 'order' | 'description' | 'meta'>,
  ) => {
    try {
      // todo: pagination
      await $api.workspace.update(workspaceId, workspaceData, {
        baseURL: appInfo.value.baseHostName ? `https://${workspaceId}.${appInfo.value.baseHostName}` : undefined,
      })

      const workspace = workspaces.value.get(workspaceId)
      if (!workspace) return

      workspaces.value.set(workspaceId, {
        ...workspace,
        ...workspaceData,
      })
      refreshCommandPalette()
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  const deleteWorkspace = async (workspaceId: string, { _skipStateUpdate }: { skipStateUpdate?: boolean } = {}) => {
    // todo: pagination
    await $api.workspace.delete(workspaceId, {
      baseURL: appInfo.value.baseHostName ? `https://${workspaceId}.${appInfo.value.baseHostName}` : undefined,
    })

    await loadWorkspaces()

    refreshCommandPalette()
  }

  const loadCollaborators = async (
    params?: { offset?: number; limit?: number; ignoreLoading?: boolean; includeDeleted?: boolean },
    workspaceId?: string,
  ) => {
    if (!workspaceId && !activeWorkspace.value?.id) {
      throw new Error('Workspace not selected')
    }

    if (!params?.ignoreLoading) isCollaboratorsLoading.value = true

    try {
      // todo: pagination
      const { list, pageInfo } = await $api.workspaceUser.list(
        workspaceId ?? activeWorkspace.value.id!,
        { ...params },
        {
          baseURL: appInfo.value.baseHostName
            ? `https://${workspaceId ?? activeWorkspace.value.id!}.${appInfo.value.baseHostName}`
            : undefined,
        },
      )

      allCollaborators.value = list
      collaborators.value = (list || [])?.filter((u) => !u?.deleted)
      workspaceUserCount.value = pageInfo.totalRows
      workspaceOwnerCount.value = collaborators.value.filter((u) => u.roles === WorkspaceUserRoles.OWNER).length
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    } finally {
      if (!params?.ignoreLoading) isCollaboratorsLoading.value = false
    }
  }

  // invite new user to the workspace
  const inviteCollaborator = async (email: string, roles: WorkspaceUserRoles, workspaceId?: string) => {
    if (!workspaceId && !activeWorkspace.value?.id) {
      throw new Error('Workspace not selected')
    }

    isInvitingCollaborators.value = true
    try {
      await $api.workspaceUser.invite(
        workspaceId ?? activeWorkspace.value.id!,
        {
          email,
          roles,
        },
        {
          baseURL: appInfo.value.baseHostName
            ? `https://${workspaceId ?? activeWorkspace.value.id!}.${appInfo.value.baseHostName}`
            : undefined,
        },
      )
      $e('a:workspace:settings:invite-user')
      await loadCollaborators({} as any, workspaceId)
      basesStore.clearBasesUser()
    } finally {
      isInvitingCollaborators.value = false
    }
  }

  // remove user from workspace
  const removeCollaborator = async (userId: string, workspaceId?: string, onCurrentUserLeftCallback?: () => void) => {
    if (removingCollaboratorMap.value[userId]) return

    try {
      if (!workspaceId && !activeWorkspace.value?.id) {
        throw new Error('Workspace not selected')
      }

      removingCollaboratorMap.value[userId] = true

      await $api.workspaceUser.delete(workspaceId ?? activeWorkspace.value.id!, userId, {
        baseURL: appInfo.value.baseHostName
          ? `https://${workspaceId ?? activeWorkspace.value.id!}.${appInfo.value.baseHostName}`
          : undefined,
      })

      $e('a:workspace:settings:remove-user')

      // if user left the workspace, navigate to home
      if (currentUser.value?.id === userId) {
        onCurrentUserLeftCallback?.()
        const list = await workspaceStore.loadWorkspaces()
        message.success(`You’ve left the workspace. Switched to ${list?.[0]?.title ?? 'another'} workspace.`)
        return await navigateTo(`/${list?.[0]?.id}`)
      }

      await loadCollaborators({} as any, workspaceId)

      basesStore.clearBasesUser()
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    } finally {
      delete removingCollaboratorMap.value[userId]
    }
  }

  // update existing collaborator role
  const updateCollaborator = async (
    userId: string,
    roles: WorkspaceUserRoles,
    workspaceId?: string,
    _overrideBaseRole: boolean = false,
  ) => {
    try {
      if (!workspaceId && !activeWorkspace.value?.id) {
        throw new Error('Workspace not selected')
      }

      await $api.workspaceUser.update(
        workspaceId,
        userId,
        {
          roles,
          /**
           * Todo: @rameshmane7218 enable this `overrideBaseRole` after adding support in backend
           */
          // overrideBaseRole,
        },
        {
          baseURL: appInfo.value.baseHostName ? `https://${activeWorkspace.value.id!}.${appInfo.value.baseHostName}` : undefined,
        },
      )

      // reload roles if updating roles of current user
      if (userId === currentUser.value?.id) {
        loadRoles(undefined, {}, workspaceId).catch(() => {
          // ignore
        })
      }

      await loadCollaborators({} as any, workspaceId)
      basesStore.clearBasesUser()
      return true
    } catch (e) {
      const errorInfo = await extractSdkResponseErrorMsgv2(e)

      if (appInfo.value?.isCloud && !appInfo.value?.isOnPrem && errorInfo.error === NcErrorType.ERR_PLAN_LIMIT_EXCEEDED) {
        throw e
      } else {
        message.error(errorInfo.message)
      }
    }
  }

  const loadWorkspace = async (workspaceId: string) => {
    try {
      const res = await $api.workspace.read(workspaceId, {
        baseURL: appInfo.value.baseHostName ? `https://${workspaceId}.${appInfo.value.baseHostName}` : undefined,
      })

      workspaces.value.set(res.workspace.id!, res.workspace)

      nocoAi.aiIntegrations.value =
        (res.workspace as WorkspaceType & { integrations: Partial<IntegrationType>[] })?.integrations || []

      workspaceUserCount.value = Number(res.workspaceUserCount)
      workspaceOwnerCount.value = Number(res.workspaceOwnerCount)

      if (res.workspace.db_job_id) {
        upgradeWsJobId.value = res.workspace.db_job_id
        upgradeWsDlg.value = true
      }

      return res
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
      navigateTo('/')
    }
  }

  async function populateWorkspace({ force, workspaceId: _workspaceId }: { force?: boolean; workspaceId?: string } = {}) {
    isWorkspaceLoading.value = true
    const workspaceId = _workspaceId ?? activeWorkspaceId.value!

    lastPopulatedWorkspaceId.value = workspaceId

    const wsState = workspaces.value.get(workspaceId)

    if (force || !wsState || !(wsState as any)?.payment) {
      await loadWorkspace(workspaceId)
      await loadRoles(route.value.params.baseId)
      await loadTeams({ workspaceId })
    }

    if (activeWorkspace.value?.status === WorkspaceStatus.CREATED) {
      await basesStore.loadProjects()
    }
    isWorkspaceLoading.value = false
  }

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

  const updateProjectTitle = async (base: BaseType & { edit: boolean; temp_title: string }, workspaceId?: string) => {
    try {
      await $api.base.update(
        base.id!,
        { title: base.temp_title },
        {
          baseURL: appInfo.value.baseHostName
            ? `https://${workspaceId || activeWorkspace.value?.id || base.fk_workspace_id}.${appInfo.value.baseHostName}`
            : undefined,
        },
      )
      base.title = base.temp_title
      base.edit = false
      refreshCommandPalette()
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  const moveWorkspace = async (workspaceId: string, baseId: string) => {
    try {
      await $api.workspaceBase.move(workspaceId, baseId, {
        baseURL: appInfo.value.baseHostName ? `https://${activeWorkspace.value?.id}.${appInfo.value.baseHostName}` : undefined,
      })
      message.success('Base moved successfully')
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  const moveToOrg = async (workspaceId: string, orgId: string) => {
    try {
      await ($api as Api<any>).orgWorkspace.add(orgId, workspaceId)
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  async function saveTheme(_theme: Partial<ThemeConfig>, _workspaceId?: string) {
    /* const fullTheme = {
      primaryColor: theme.value.primaryColor,
      accentColor: theme.value.accentColor,
      ..._theme,
    }

    await updateWorkspace(workspaceId || activeWorkspace.value!.id!, {
      meta: {
        ...(workspaceId ? workspaces.value.get(workspaceId) : activeWorkspace.value),
        theme: fullTheme,
      },
    })

    setTheme(fullTheme)

    $e('c:themes:change') */
  }

  const clearWorkspaces = async () => {
    await basesStore.clearBases()
    workspaces.value.clear()
  }
  const upgradeActiveWorkspace = async () => {
    const workspace = activeWorkspace.value
    if (!workspace) {
      throw new Error('Workspace not selected')
    }
    await $api.workspace.upgrade(workspace.id!, {
      baseURL: appInfo.value.baseHostName ? `https://${activeWorkspace.value?.id}.${appInfo.value.baseHostName}` : undefined,
    })
    await loadWorkspaces()
  }

  const navigateToWorkspace = async (workspaceId?: string) => {
    workspaceId = workspaceId || activeWorkspaceId.value!
    if (!workspaceId) {
      throw new Error('Workspace not selected')
    }
    ncNavigateTo({ workspaceId })
  }

  const navigateToWorkspaceSettings = async (workspaceId?: string, cmdOrCtrl?: boolean, query: Record<string, string> = {}) => {
    workspaceId = workspaceId || activeWorkspaceId.value!
    if (!workspaceId) {
      throw new Error('Workspace not selected')
    }

    if (cmdOrCtrl) {
      await navigateTo(router.resolve({ name: 'index-typeOrId-settings', params: { typeOrId: workspaceId }, query }).href, {
        open: navigateToBlankTargetOpenOption,
      })
    } else {
      router.push({ name: 'index-typeOrId-settings', params: { typeOrId: workspaceId }, query })
    }
  }

  const navigateToFeed = async (workspaceId?: string, cmdOrCtrl?: boolean, query: Record<string, string> = {}) => {
    workspaceId = workspaceId || activeWorkspaceId.value!

    if (cmdOrCtrl) {
      await navigateTo(router.resolve({ name: 'index-typeOrId-feed', params: { typeOrId: workspaceId }, query }).href, {
        open: navigateToBlankTargetOpenOption,
      })
    } else {
      router.push({ name: 'index-typeOrId-feed', params: { typeOrId: workspaceId }, query })
    }
  }

  const navigateToIntegrations = async (workspaceId?: string, cmdOrCtrl?: boolean, query: Record<string, string> = {}) => {
    workspaceId = workspaceId || activeWorkspaceId.value!

    if (!workspaceId) {
      throw new Error('Workspace not selected')
    }

    if (cmdOrCtrl) {
      await navigateTo(
        router.resolve({
          name: 'index-typeOrId-integrations',
          params: { typeOrId: workspaceId },
          query,
        }).href,
        {
          open: navigateToBlankTargetOpenOption,
        },
      )
    } else {
      router.push({ name: 'index-typeOrId-integrations', params: { typeOrId: workspaceId }, query })
    }
  }

  function setLoadingState(isLoading = false) {
    isWorkspaceLoading.value = isLoading
  }

  const workspaceRole = computed(() => activeWorkspace.value?.roles)

  const getPlanLimit = (limitType: PlanLimitTypes) => {
    const limit = activeWorkspace.value?.payment?.plan?.meta?.[limitType] ?? Infinity
    return limit === -1 ? Infinity : limit
  }

  const toggleSsoLoginRequiredDlg = (show = !ssoLoginRequiredDlg.value) => {
    ssoLoginRequiredDlg.value = show
  }

  /**
   * Teams section start here
   */
  const isTeamsLoading = ref(true)

  const teams = ref<TeamV3V3Type[]>([])

  const teamsMap = computed(() => {
    return (teams.value || [])?.reduce((acc, curr) => {
      if (curr.id) {
        acc[curr.id] = curr
      }
      return acc
    }, {} as Record<string, TeamV3V3Type>)
  })

  const editTeamDetails = ref<TeamDetailV3V3Type | null>(null)

  async function loadTeams({ workspaceId }: { workspaceId: string }) {
    if (!isUIAllowed('teamList')) return

    isTeamsLoading.value = true

    try {
      const { list } = await $api.internal.getOperation(workspaceId, NO_SCOPE, {
        operation: 'teamList',
      })

      teams.value = list
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    } finally {
      isTeamsLoading.value = false
    }
  }

  async function getTeamById(workspaceId: string, teamId: string) {
    if (!isUIAllowed('teamGet')) return

    try {
      const teamDetails = (await $api.internal.getOperation(workspaceId, NO_SCOPE, {
        operation: 'teamGet',
        teamId,
      })) as TeamDetailV3V3Type

      editTeamDetails.value = teamDetails

      return teamDetails
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  async function createTeam(workspaceId: string, team: Pick<TeamType, 'title' | 'description' | 'meta'>) {
    try {
      const res = (await $api.internal.postOperation(
        workspaceId,
        NO_SCOPE,
        {
          operation: 'teamCreate',
        },
        team,
      )) as TeamV3V3Type

      if (!res) return

      teams.value.push(res)
      return team
    } catch (error: any) {
      console.error(error)
      message.error('Error occured while creating new team')
    }
  }

  async function updateTeam(workspaceId: string, teamId: string, updates: TeamUpdateV3ReqV3Type) {
    if (!updates) return

    try {
      const res = (await $api.internal.postOperation(
        workspaceId,
        NO_SCOPE,
        {
          operation: 'teamUpdate',
        },
        {
          teamId,
          ...updates,
        },
      )) as TeamV3V3Type

      if (!res) return

      teams.value = teams.value.map((team) => (team.id === teamId ? { ...team, ...res } : team))

      return res
    } catch (error: any) {
      console.error(error)
      message.error('Error occured while updating team')
    }
  }

  async function addTeamMembers(
    workspaceId: string = activeWorkspaceId.value!,
    teamId: string,
    members: TeamMembersAddV3ReqV3Type[],
  ) {
    try {
      const addedMembers = (await $api.internal.postOperation(
        workspaceId,
        NO_SCOPE,
        {
          operation: 'teamMembersAdd',
        },
        {
          teamId,
          members,
        },
      )) as TeamMemberV3ResponseV3Type[]

      if (editTeamDetails.value && ncIsArray(addedMembers)) {
        editTeamDetails.value.members = [...(editTeamDetails.value.members || []), ...addedMembers]
      }

      if (teamsMap.value[teamId]) {
        teamsMap.value[teamId].members_count = (teamsMap.value[teamId].members_count || 0) + addedMembers.length
      }

      return addedMembers || []
    } catch (e: any) {
      console.error('Failed to add members', e)
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  async function removeTeamMembers(
    workspaceId: string = activeWorkspaceId.value!,
    teamId: string,
    members: TeamMembersRemoveV3ReqV3Type[],
  ) {
    try {
      const removedMembers = (await $api.internal.postOperation(
        workspaceId,
        NO_SCOPE,
        {
          operation: 'teamMembersRemove',
        },
        {
          teamId,
          members,
        },
      )) as TeamMembersRemoveV3ReqV3Type[]

      if (editTeamDetails.value && ncIsArray(removedMembers)) {
        editTeamDetails.value.members = (editTeamDetails.value.members || []).filter(
          (member) => !removedMembers.find((rm) => rm.user_id === member.user_id),
        )
      }

      if (teamsMap.value[teamId]) {
        teamsMap.value[teamId].members_count = Math.max(0, (teamsMap.value[teamId].members_count || 0) - removedMembers.length)
      }

      return removedMembers || []
    } catch (e: any) {
      console.error('Failed to remove members', e)
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  async function updateTeamMembers(
    workspaceId: string = activeWorkspaceId.value!,
    teamId: string,
    members: TeamMembersUpdateV3ReqV3Type[],
  ) {
    try {
      const updatedMembers = (await $api.internal.postOperation(
        workspaceId,
        NO_SCOPE,
        {
          operation: 'teamMembersUpdate',
        },
        {
          teamId,
          members,
        },
      )) as TeamMemberV3ResponseV3Type[]

      if (editTeamDetails.value && ncIsArray(updatedMembers)) {
        editTeamDetails.value.members = (editTeamDetails.value.members || []).map((member) => {
          const updatedMember = updatedMembers.find((um) => um.user_id === member.user_id)
          if (!updatedMember) return member

          return {
            ...member,
            ...updatedMember,
          }
        })
      }

      return updatedMembers || []
    } catch (e: any) {
      console.error('Failed to update members', e)
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  /**
   * Teams section end here
   */

  /**
   * Watchers
   */
  watch(activeWorkspaceId, async () => {
    await loadRoles(undefined, {}, activeWorkspaceId.value)
    await loadTeams({ workspaceId: activeWorkspaceId.value! })
  })

  watch(
    () => activeWorkspace.value?.id,
    () => {
      if (!activeWorkspaceId.value) return
      storage.value.lastOpenedWorkspaceId = activeWorkspaceId.value
    },
  )

  return {
    loadWorkspaces,
    workspaces,
    workspacesList,
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
    isWorkspacesLoading,
    populateWorkspace,
    clearWorkspaces,
    upgradeActiveWorkspace,
    navigateToWorkspace,
    setLoadingState,
    isSharedBase,
    navigateToWorkspaceSettings,
    lastPopulatedWorkspaceId,
    workspaceRole,
    isWorkspaceSettingsPageOpened,
    workspaceUserCount,
    workspaceOwnerCount,
    getPlanLimit,
    moveToOrg,
    isIntegrationsPageOpened,
    navigateToIntegrations,
    navigateToFeed,
    isFeedPageOpened,
    deletingWorkspace,
    ssoLoginRequiredDlg,
    toggleSsoLoginRequiredDlg,
    upgradeWsDlg,
    upgradeWsJobId,
    removingCollaboratorMap,

    // Teams
    teams,
    teamsMap,
    isTeamsLoading,
    editTeamDetails,
    createTeam,
    updateTeam,
    loadTeams,
    getTeamById,
    addTeamMembers,
    removeTeamMembers,
    updateTeamMembers,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useWorkspace as any, import.meta.hot))
}
