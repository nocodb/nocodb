import type { ProjectType, WorkspaceType, WorkspaceUserType } from 'nocodb-sdk'
import { WorkspaceStatus, WorkspaceUserRoles } from 'nocodb-sdk'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { message } from 'ant-design-vue'
import { isString } from '@vue/shared'
import { computed, ref, useCommandPalette, useNuxtApp, useRouter, useTheme } from '#imports'
import type { ThemeConfig } from '#imports'

interface NcWorkspace extends WorkspaceType {
  edit?: boolean
  temp_title?: string | null
  roles?: string
}

export const useWorkspace = defineStore('workspaceStore', () => {
  // todo: update type in swagger
  const projectsStore = useProjects()
  const { clearProjects } = projectsStore

  const { loadRoles } = useRoles()

  const collaborators = ref<WorkspaceUserType[] | null>()

  const lastPopulatedWorkspaceId = ref<string | null>(null)

  const router = useRouter()

  const route = router.currentRoute

  const { $api } = useNuxtApp()

  const { refreshCommandPalette } = useCommandPalette()

  const { setTheme, theme } = useTheme()

  const { $e } = useNuxtApp()

  const { appInfo, ncNavigateTo } = useGlobal()

  const { isUIAllowed } = useUIPermission()

  const isSharedBase = computed(() => route.value.params.typeOrId === 'base')

  const isWorkspaceSettingsPageOpened = computed(() => route.value.name === 'index-typeOrId-settings')

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
    return (route.value.query.workspaceId ?? route.value.params.typeOrId ?? workspacesList.value?.[0]?.id) as string | undefined
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
  const loadWorkspaces = async (ignoreError = false) => {
    try {
      // todo: pagination
      const { list, pageInfo: _ } = await $api.workspace.list()
      for (const workspace of list ?? []) {
        workspaces.value.set(workspace.id!, workspace)
      }
    } catch (e: any) {
      if (!ignoreError) message.error(await (e))
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
            const color = projectThemeColors[Math.floor(Math.random() * 1000) % projectThemeColors.length]
            return { ...workspace, title, meta: { color } }
          })
      } else {
        // pick a random color from array and assign to workspace
        const color = projectThemeColors[Math.floor(Math.random() * 1000) % projectThemeColors.length]
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

  const loadCollaborators = async (params?: { offset?: number; limit?: number; ignoreLoading: boolean }) => {
    if (!activeWorkspace.value?.id) {
      throw new Error('Workspace not selected')
    }

    if (!params?.ignoreLoading) isCollaboratorsLoading.value = true

    try {
      // todo: pagination
      const { list, pageInfo: _ } = await $api.workspaceUser.list(activeWorkspace.value.id!, {
        query: params,
        baseURL: appInfo.value.baseHostName ? `https://${activeWorkspace.value.id!}.${appInfo.value.baseHostName}` : undefined,
      })

      collaborators.value = list
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    } finally {
      if (!params?.ignoreLoading) isCollaboratorsLoading.value = false
    }
  }

  // invite new user to the workspace
  const inviteCollaborator = async (email: string, roles: WorkspaceUserRoles) => {
    if (!activeWorkspace.value?.id) {
      throw new Error('Workspace not selected')
    }

    isInvitingCollaborators.value = true
    try {
      await $api.workspaceUser.invite(
        activeWorkspace.value.id!,
        {
          email,
          roles,
        },
        {
          baseURL: appInfo.value.baseHostName ? `https://${activeWorkspace.value.id!}.${appInfo.value.baseHostName}` : undefined,
        },
      )
      await loadCollaborators()
    } finally {
      isInvitingCollaborators.value = false
    }
  }

  // remove user from workspace
  const removeCollaborator = async (userId: string) => {
    if (!activeWorkspace.value?.id) {
      throw new Error('Workspace not selected')
    }

    await $api.workspaceUser.delete(activeWorkspace.value.id!, userId, {
      baseURL: appInfo.value.baseHostName ? `https://${activeWorkspace.value.id!}.${appInfo.value.baseHostName}` : undefined,
    })
    await loadCollaborators()
  }

  // update existing collaborator role
  const updateCollaborator = async (userId: string, roles: WorkspaceUserRoles) => {
    if (!activeWorkspace.value?.id) {
      throw new Error('Workspace not selected')
    }

    await $api.workspaceUser.update(
      activeWorkspace.value.id!,
      userId,
      {
        roles,
      },
      {
        baseURL: appInfo.value.baseHostName ? `https://${activeWorkspace.value.id!}.${appInfo.value.baseHostName}` : undefined,
      },
    )
    await loadCollaborators()
  }

  const loadWorkspace = async (workspaceId: string) => {
    const workspace = await $api.workspace.read(workspaceId, {
      baseURL: appInfo.value.baseHostName ? `https://${workspaceId}.${appInfo.value.baseHostName}` : undefined,
    })
    workspaces.value.set(workspace.id!, workspace)
  }

  async function populateWorkspace({ force, workspaceId: _workspaceId }: { force?: boolean; workspaceId?: string } = {}) {
    isWorkspaceLoading.value = true
    const workspaceId = _workspaceId ?? activeWorkspaceId.value!

    lastPopulatedWorkspaceId.value = workspaceId

    if (force || !workspaces.value.get(workspaceId)) {
      await loadWorkspace(workspaceId)
      await loadRoles()
    }

    if (activeWorkspace.value?.status === WorkspaceStatus.CREATED) {
      await projectsStore.loadProjects()
    }
    isWorkspaceLoading.value = false
  }

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
          baseURL: appInfo.value.baseHostName
            ? `https://${activeWorkspace.value?.id || project.fk_workspace_id}.${appInfo.value.baseHostName}`
            : undefined,
        },
      )
      project.title = project.temp_title
      project.edit = false
      refreshCommandPalette()
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  const moveWorkspace = async (workspaceId: string, projectId: string) => {
    try {
      await $api.workspaceProject.move(workspaceId, projectId, {
        baseURL: appInfo.value.baseHostName ? `https://${activeWorkspace.value?.id}.${appInfo.value.baseHostName}` : undefined,
      })
      message.success('Project moved successfully')
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

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

  const clearWorkspaces = async () => {
    await clearProjects()
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

  const navigateToWorkspaceSettings = async (workspaceId?: string) => {
    workspaceId = workspaceId || activeWorkspaceId.value!
    if (!workspaceId) {
      throw new Error('Workspace not selected')
    }

    await router.push({ name: 'index-typeOrId-settings', params: { typeOrId: workspaceId } })
  }

  function setLoadingState(isLoading = false) {
    isWorkspaceLoading.value = isLoading
  }

  const workspaceRole = computed(() => activeWorkspace.value?.roles)

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
    isSharedBase,
    navigateToWorkspaceSettings,
    lastPopulatedWorkspaceId,
    workspaceRole,
    isWorkspaceSettingsPageOpened,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useWorkspace as any, import.meta.hot))
}
