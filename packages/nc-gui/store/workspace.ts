import type { ProjectType } from 'nocodb-sdk'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { message } from 'ant-design-vue'
import { isString } from '@vue/shared'
import { computed, navigateTo, ref, useCommandPalette, useNuxtApp, useProjects, useRouter, useTheme } from '#imports'
import type { ThemeConfig } from '#imports'

export const useWorkspace = defineStore('workspaceStore', () => {
  const projectsStore = useProjects()

  const collaborators = ref<any[] | null>()

  const router = useRouter()

  const route = router.currentRoute

  const { $api } = useNuxtApp()

  const { refreshCommandPalette } = useCommandPalette()

  const lastPopulatedWorkspaceId = ref<string | null>(null)

  const { setTheme, theme } = useTheme()

  const { $e } = useNuxtApp()

  const { appInfo, ncNavigateTo } = useGlobal()

  const { orgRoles } = useRoles()

  const workspaces = ref<Map<string, any>>(new Map())
  const workspacesList = computed<any[]>(() => Array.from(workspaces.value.values()).sort((a, b) => a.updated_at - b.updated_at))

  const isWorkspaceSettingsPageOpened = computed(() => route.value.name === 'index-typeOrId-settings')

  const isWorkspaceLoading = ref(true)
  const isCollaboratorsLoading = ref(true)
  const isInvitingCollaborators = ref(false)

  const activePage = computed<'workspace' | 'recent' | 'shared' | 'starred'>(
    () => (route.value.query.page as 'workspace' | 'recent' | 'shared' | 'starred') ?? 'recent',
  )

  const activeWorkspaceId = computed(() => {
    return 'default'
  })

  const activeWorkspace = computed(() => {
    return { id: 'default', title: 'default', meta: {}, roles: '' } as any
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

  /** getters */
  const isWorkspaceCreator = computed(() => {
    // todo: type correction
    return orgRoles.value?.[Role.OrgLevelCreator]
  })

  const isWorkspaceOwner = computed(() => {
    // todo: type correction
    return orgRoles.value?.[Role.OrgLevelCreator]
  })

  const isWorkspaceOwnerOrCreator = computed(() => {
    // todo: type correction
    return orgRoles.value?.[Role.OrgLevelCreator]
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

  async function populateWorkspace(..._args: any) {
    isWorkspaceLoading.value = true

    try {
      await projectsStore.loadProjects()
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
    await projectsStore.loadProjects(page)
  })

  const addToFavourite = async (projectId: string) => {
    try {
      const projects = projectsStore.projects
      const project = projects.get(projectId)
      if (!project) return

      // todo: update the type
      project.starred = true

      await $api.project.userMetaUpdate(
        projectId,
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

  const removeFromFavourite = async (projectId: string) => {
    try {
      const project = projectsStore.projects.get(projectId)
      if (!project) return

      project.starred = false

      await $api.project.userMetaUpdate(
        projectId,
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

  const updateProjectTitle = async (project: ProjectType & { edit: boolean; temp_title: string }) => {
    try {
      await $api.project.update(
        project.id!,
        { title: project.temp_title },
        {
          baseURL: appInfo.value.baseHostName ? `https://${activeWorkspace.value.id}.${appInfo.value.baseHostName}` : undefined,
        },
      )
      project.title = project.temp_title
      project.edit = false
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
    await projectsStore.clearProjects()
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

  const navigateToWorkspaceSettings = async () => {
    navigateTo('/account/users')
  }

  function setLoadingState(isLoading = false) {
    isWorkspaceLoading.value = isLoading
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
    isWorkspaceCreator,
    isWorkspaceOwner,
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
    isWorkspaceOwnerOrCreator,
    setLoadingState,
    navigateToWorkspaceSettings,
    lastPopulatedWorkspaceId,
    isWorkspaceSettingsPageOpened,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useWorkspace as any, import.meta.hot))
}
