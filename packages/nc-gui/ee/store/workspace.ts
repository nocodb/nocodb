import type {
  Api,
  AuditType,
  BaseType,
  PaginatedType,
  PlanLimitTypes,
  WorkspaceType,
  WorkspaceUserRoles,
  WorkspaceUserType,
} from 'nocodb-sdk'
import { WorkspaceStatus } from 'nocodb-sdk'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { message } from 'ant-design-vue'
import { isString } from '@vue/shared'
import type { AuditLogsQuery } from '~/lib/types'

interface NcWorkspace extends WorkspaceType {
  edit?: boolean
  temp_title?: string | null
  roles?: string
}

const defaultAuditLogsQuery = {
  type: undefined,
  baseId: undefined,
  sourceId: undefined,
  user: undefined,
  startDate: undefined,
  endDate: undefined,
  dateRangeLabel: undefined,
  orderBy: {
    created_at: 'desc',
    user: undefined,
  },
} as AuditLogsQuery

export const useWorkspace = defineStore('workspaceStore', () => {
  // todo: update type in swagger
  const basesStore = useBases()

  const workspaceStore = useWorkspace()

  const { loadRoles, isUIAllowed } = useRoles()

  const { user: currentUser } = useGlobal()

  const collaborators = ref<WorkspaceUserType[] | null>()

  const allCollaborators = ref<WorkspaceUserType[] | null>()

  const lastPopulatedWorkspaceId = ref<string | null>(null)

  const router = useRouter()

  const route = router.currentRoute

  const { $api } = useNuxtApp()

  const { refreshCommandPalette } = useCommandPalette()

  const { setTheme, theme } = useTheme()

  const { $e } = useNuxtApp()

  const { appInfo, ncNavigateTo, lastOpenedWorkspaceId, storage } = useGlobal()

  const workspaceUserCount = ref<number | undefined>(undefined)

  const isSharedBase = computed(() => route.value.params.typeOrId === 'base')

  const isWorkspaceSettingsPageOpened = computed(() => route.value.name === 'index-typeOrId-settings')

  const isIntegrationsPageOpened = computed(() => route.value.name === 'index-typeOrId-integrations')

  const workspaces = ref<Map<string, NcWorkspace>>(new Map())
  const workspacesList = computed<NcWorkspace[]>(() =>
    Array.from(workspaces.value.values()).sort((a, b) => a.updated_at - b.updated_at),
  )

  const isWorkspaceLoading = ref(true)
  const isCollaboratorsLoading = ref(true)
  const isInvitingCollaborators = ref(false)

  const activePage = computed<'workspace' | 'recent' | 'shared' | 'starred'>(
    () => (route.value.query.page as 'workspace' | 'recent' | 'shared' | 'starred') ?? 'workspace',
  )

  const activeWorkspaceId = computed(() => {
    if (route.value.query.workspaceId) return route.value.query.workspaceId as string

    if (route.value.params.typeOrId) return route.value.params.typeOrId as string

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
      for (const workspace of list ?? []) {
        const oldData = workspaces.value.has(workspace.id!) ? workspaces.value.get(workspace.id!) : {}
        workspaces.value.set(workspace.id!, {
          ...oldData,
          ...workspace,
        })
      }
      return list
    } catch (e: any) {
      if (!ignoreError) message.error(await e)
    }
  }

  const createWorkspace = async (workspace: Pick<WorkspaceType, 'title' | 'order' | 'description' | 'meta'>) => {
    try {
      let reqPayload

      if (workspace.title!.includes(',')) {
        reqPayload = workspace
          .title!.split(',')
          .filter((t) => t.trim())
          .map((title) => {
            // pick a random color from array and assign to workspace
            const color = baseThemeColors[Math.floor(Math.random() * 1000) % baseThemeColors.length]
            return { ...workspace, title, meta: { color } }
          })
      } else {
        // pick a random color from array and assign to workspace
        const color = baseThemeColors[Math.floor(Math.random() * 1000) % baseThemeColors.length]
        reqPayload = { ...workspace, meta: { color } }
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

  const deleteWorkspace = async (workspaceId: string, { skipStateUpdate }: { skipStateUpdate?: boolean } = {}) => {
    // todo: pagination
    await $api.workspace.delete(workspaceId, {
      baseURL: appInfo.value.baseHostName ? `https://${workspaceId}.${appInfo.value.baseHostName}` : undefined,
    })

    if (!skipStateUpdate) workspaces.value.delete(workspaceId)

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
  const removeCollaborator = async (userId: string, workspaceId?: string) => {
    try {
      if (!workspaceId && !activeWorkspace.value?.id) {
        throw new Error('Workspace not selected')
      }

      await $api.workspaceUser.delete(workspaceId ?? activeWorkspace.value.id!, userId, {
        baseURL: appInfo.value.baseHostName
          ? `https://${workspaceId ?? activeWorkspace.value.id!}.${appInfo.value.baseHostName}`
          : undefined,
      })

      $e('a:workspace:settings:remove-user')

      // if user left the workspace, navigate to home
      if (currentUser.value?.id === userId) {
        const list = await workspaceStore.loadWorkspaces()
        return await navigateTo(`/${list?.[0]?.id}`)
      }

      await loadCollaborators({} as any, workspaceId)

      basesStore.clearBasesUser()
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  // update existing collaborator role
  const updateCollaborator = async (userId: string, roles: WorkspaceUserRoles, workspaceId?: string) => {
    try {
      if (!workspaceId && !activeWorkspace.value?.id) {
        throw new Error('Workspace not selected')
      }

      await $api.workspaceUser.update(
        workspaceId,
        userId,
        {
          roles,
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
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  const loadWorkspace = async (workspaceId: string) => {
    try {
      const res = await $api.workspace.read(workspaceId, {
        baseURL: appInfo.value.baseHostName ? `https://${workspaceId}.${appInfo.value.baseHostName}` : undefined,
      })

      workspaces.value.set(res.workspace.id!, res.workspace)

      workspaceUserCount.value = Number(res.workspaceUserCount)
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

    if (force || !wsState || !(wsState as any)?.limits) {
      await loadWorkspace(workspaceId)
      await loadRoles()
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

  async function saveTheme(_theme: Partial<ThemeConfig>, workspaceId?: string) {
    const fullTheme = {
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

    $e('c:themes:change')
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
    await ncNavigateTo({ workspaceId })
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

  const auditLogsQuery = ref<AuditLogsQuery>(defaultAuditLogsQuery)

  const audits = ref<null | Array<AuditType>>(null)

  const auditPaginationData = ref<PaginatedType>({ page: 1, pageSize: 25, totalRows: 0 })

  const loadAudits = async (
    workspaceId?: string,
    page: number = auditPaginationData.value.page!,
    limit: number = auditPaginationData.value.pageSize!,
  ) => {
    try {
      if (isUIAllowed('workspaceAuditList') && !workspaceId) return

      if (limit * (page - 1) > auditPaginationData.value.totalRows!) {
        auditPaginationData.value.page = 1
        page = 1
      }

      const { list, pageInfo } = isUIAllowed('workspaceAuditList')
        ? await $api.workspace.auditList(workspaceId, {
            offset: limit * (page - 1),
            limit,
            ...auditLogsQuery.value,
          })
        : await $api.base.auditList(auditLogsQuery.value.baseId, {
            offset: limit * (page - 1),
            limit,
            ...auditLogsQuery.value,
          })

      audits.value = list
      auditPaginationData.value.totalRows = pageInfo.totalRows ?? 0
    } catch (e) {
      message.error(await extractSdkResponseErrorMsg(e))
      audits.value = []
      auditPaginationData.value.totalRows = 0
      auditPaginationData.value.page = 1
    }
  }

  function setLoadingState(isLoading = false) {
    isWorkspaceLoading.value = isLoading
  }

  const workspaceRole = computed(() => activeWorkspace.value?.roles)

  const getPlanLimit = (limitType: PlanLimitTypes) => {
    return activeWorkspace.value?.limits?.[limitType] ?? 0
  }

  watch(activeWorkspaceId, async () => {
    auditLogsQuery.value = defaultAuditLogsQuery
    await loadRoles(undefined, {}, activeWorkspaceId.value)
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
    isSharedBase,
    navigateToWorkspaceSettings,
    lastPopulatedWorkspaceId,
    workspaceRole,
    isWorkspaceSettingsPageOpened,
    workspaceUserCount,
    getPlanLimit,
    moveToOrg,
    auditLogsQuery,
    audits,
    auditPaginationData,
    loadAudits,
    isIntegrationsPageOpened,
    navigateToIntegrations,
    navigateToFeed,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useWorkspace as any, import.meta.hot))
}
