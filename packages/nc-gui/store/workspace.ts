import type { ProjectType } from 'nocodb-sdk'
import { WorkspaceUserRoles } from 'nocodb-sdk'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { message } from 'ant-design-vue'
import { isString } from '@vue/shared'
import { computed, ref, useCommandPalette, useNuxtApp, useRouter, useTheme } from '#imports'
import type { ThemeConfig } from '~/lib'

export const useWorkspace = defineStore('workspaceStore', () => {
  const projectsStore = useProjects()

  const collaborators = ref<any[] | null>()

  const router = useRouter()

  const route = router.currentRoute

  const { $api } = useNuxtApp()

  const { refreshCommandPalette } = useCommandPalette()

  const { setTheme, theme } = useTheme()

  const { $e } = useNuxtApp()

  const { appInfo } = $(useGlobal())

  const workspaces = ref<Map<string, any>>(new Map())
  const workspacesList = computed<any[]>(() => Array.from(workspaces.value.values()).sort((a, b) => a.updated_at - b.updated_at))

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
    return { id: 'default', title: 'default', meta: {}, roles: '' }
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
    return (
      activeWorkspace.value?.roles === WorkspaceUserRoles.CREATOR || activeWorkspace.value?.roles === WorkspaceUserRoles.OWNER
    )
  })

  const isWorkspaceOwner = computed(() => {
    // todo: type correction
    return activeWorkspace.value?.roles === WorkspaceUserRoles.OWNER
  })

  const isWorkspaceOwnerOrCreator = computed(() => {
    // todo: type correction
    return (
      activeWorkspace.value?.roles === WorkspaceUserRoles.OWNER || activeWorkspace.value?.roles === WorkspaceUserRoles.CREATOR
    )
  })

  /** actions */
  const loadWorkspaces = async () => {}

  const createWorkspace = async (..._args: any) => {}

  const updateWorkspace = async (..._args: any) => {}

  const deleteWorkspace = async (..._args: any) => {}

  const loadCollaborators = async (..._args: any) => {}

  const inviteCollaborator = async (..._args: any) => {}

  const removeCollaborator = async (..._args: any) => {}

  const updateCollaborator = async (..._args: any) => {}

  const loadWorkspace = async (..._args: any) => {}

  async function populateWorkspace(..._args: any) {}

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
          baseURL: appInfo.baseHostName ? `https://${activeWorkspace.value?.id}.${appInfo.baseHostName}` : undefined,
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
          baseURL: appInfo.baseHostName ? `https://${activeWorkspace.value?.id}.${appInfo.baseHostName}` : undefined,
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
          baseURL: appInfo.baseHostName ? `https://${activeWorkspace.value.id}.${appInfo.baseHostName}` : undefined,
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

  const clearWorkspaces = () => {
    const { clearProjects } = useProjects()

    clearProjects()
    workspaces.value.clear()
  }
  const upgradeActiveWorkspace = async () => {}

  const navigateToWorkspace = async (workspaceId?: string) => {
    if (!workspaceId) {
      return await router.push({ query: { page: 'workspace' } })
    }
    await router.push({ query: { workspaceId, page: 'workspace' } })
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
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useWorkspace as any, import.meta.hot))
}
