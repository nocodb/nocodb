import type { BaseType } from 'nocodb-sdk'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { message } from 'ant-design-vue'
import { isString } from '@vue/shared'

export const useWorkspace = defineStore('workspaceStore', () => {
  const basesStore = useBases()

  const collaborators = ref<any[] | null>()

  const allCollaborators = ref<any[] | null>()

  const router = useRouter()

  const route = router.currentRoute

  const { $api } = useNuxtApp()

  const { refreshCommandPalette } = useCommandPalette()

  const lastPopulatedWorkspaceId = ref<string | null>(null)

  const { setTheme, theme } = useTheme()

  const { $e } = useNuxtApp()

  const { appInfo, ncNavigateTo } = useGlobal()

  const workspaces = ref<Map<string, any>>(new Map())
  const workspacesList = computed<any[]>(() => Array.from(workspaces.value.values()).sort((a, b) => a.updated_at - b.updated_at))

  const isWorkspaceSettingsPageOpened = computed(() => route.value.name === 'index-typeOrId-settings')

  const isIntegrationsPageOpened = computed(() => route.value.name === 'index-typeOrId-integrations')

  const isFeedPageOpened = computed(() => route.value.name === 'index-typeOrId-feed')

  const isWorkspaceLoading = ref(true)
  const isCollaboratorsLoading = ref(true)
  const isInvitingCollaborators = ref(false)
  const workspaceUserCount = ref<number | undefined>(undefined)

  const activePage = computed<'workspace' | 'recent' | 'shared' | 'starred'>(
    () => (route.value.query.page as 'workspace' | 'recent' | 'shared' | 'starred') ?? 'recent',
  )

  const activeWorkspaceId = computed(() => {
    return 'default'
  })

  const activeWorkspace = computed(() => {
    return { id: 'default', title: 'default', meta: {}, roles: '' } as any
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

  const loadCollaborators = async (..._args: any) => {}

  const inviteCollaborator = async (..._args: any) => {}

  const removeCollaborator = async (..._args: any) => {}

  const updateCollaborator = async (..._args: any) => {}

  const loadWorkspace = async (..._args: any) => {}

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
    const fullTheme = {
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

    $e('c:themes:change')
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

    await ncNavigateTo({
      workspaceId,
    })
  }

  const navigateToWorkspaceSettings = async (_?: string, cmdOrCtrl?: boolean) => {
    if (cmdOrCtrl) {
      await navigateTo('#/account/users', {
        open: navigateToBlankTargetOpenOption,
      })
    } else {
      await navigateTo('/account/users')
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

  const navigateToFeed = async (_?: string, cmdOrCtrl?: boolean) => {
    if (cmdOrCtrl) {
      await navigateTo('/nc/feed', {
        open: navigateToBlankTargetOpenOption,
      })
    } else {
      await navigateTo('/nc/feed')
    }
  }

  function setLoadingState(isLoading = false) {
    isWorkspaceLoading.value = isLoading
  }

  const getPlanLimit = (_arg: any) => {
    return 9999
  }

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
    navigateToWorkspaceSettings,
    lastPopulatedWorkspaceId,
    isWorkspaceSettingsPageOpened,
    workspaceUserCount,
    getPlanLimit,
    workspaceRole,
    moveToOrg,
    navigateToFeed,
    isIntegrationsPageOpened,
    navigateToIntegrations,
    isFeedPageOpened,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useWorkspace as any, import.meta.hot))
}
