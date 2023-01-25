import type { ProjectType, WorkspaceType, WorkspaceUserType } from 'nocodb-sdk'
import { WorkspaceUserRoles } from 'nocodb-sdk'
import { message } from 'ant-design-vue'
import { useRoute } from 'vue-router'
import { extractSdkResponseErrorMsg, projectThemeColors, useInjectionState, useNuxtApp } from '#imports'

const [useProvideWorkspaceStore, useWorkspaceStore] = useInjectionState(() => {
  const workspaces = ref<(WorkspaceType & { edit?: boolean; temp_title?: string; roles?: string })[]>([])

  // const activeWorkspace = ref<WorkspaceType | null>()

  // todo: update type in swagger
  const projects = ref<(ProjectType & { temp_title?: string; edit?: boolean; starred?: boolean })[] | null>()

  const collaborators = ref<WorkspaceUserType[] | null>()

  const route = useRoute()

  const { $api } = useNuxtApp()

  const activePage = computed<'workspace' | 'recent' | 'shared' | 'starred'>(
    () => (route.query.page as 'workspace' | 'recent' | 'shared' | 'starred') ?? 'workspace',
  )

  const activeWorkspace = computed(() => {
    return (
      workspaces.value?.find((w) => w.id === route.query.workspaceId) ??
      (activePage.value === 'workspace' ? workspaces.value?.[0] : null)
    )
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

  /** actions */
  const loadWorkspaceList = async () => {
    try {
      // todo: pagination
      const { list, pageInfo: _ } = await $api.workspace.list()
      workspaces.value = list ?? []
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
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
      await $api.workspace.create(reqPayload)
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  const updateWorkspace = async (
    workspaceId: string,
    workspace: Pick<WorkspaceType, 'title' | 'order' | 'description' | 'meta'>,
  ) => {
    try {
      // todo: pagination
      await $api.workspace.update(workspaceId, workspace)
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  const deleteWorkspace = async (workspaceId: string) => {
    // todo: pagination
    await $api.workspace.delete(workspaceId)
  }

  const loadProjects = async (page?: 'recent' | 'shared' | 'starred' | 'workspace') => {
    if ((!page || page === 'workspace') && !activeWorkspace.value?.id) {
      throw new Error('Workspace not selected')
    }

    if (activeWorkspace.value?.id) {
      const { list } = await $api.workspaceProject.list(activeWorkspace.value?.id)
      projects.value = list
    } else {
      const { list } = await $api.project.list(
        page
          ? {
              [page]: true,
            }
          : {},
      )
      projects.value = list
    }
  }

  const loadCollaborators = async (params?: { offset?: number; limit?: number }) => {
    if (!activeWorkspace.value?.id) {
      throw new Error('Workspace not selected')
    }

    // todo: pagination
    const { list, pageInfo: _ } = await $api.workspaceUser.list(activeWorkspace.value.id!, { query: params })

    collaborators.value = list
  }

  // invite new user to the workspace
  const inviteCollaborator = async (email: string, roles: WorkspaceUserRoles) => {
    if (!activeWorkspace.value?.id) {
      throw new Error('Workspace not selected')
    }

    await $api.workspaceUser.invite(activeWorkspace.value.id!, {
      email,
      roles,
    })
    await loadCollaborators()
  }

  // remove user from workspace
  const removeCollaborator = async (userId: string) => {
    if (!activeWorkspace.value?.id) {
      throw new Error('Workspace not selected')
    }

    await $api.workspaceUser.delete(activeWorkspace.value.id!, userId)
    await loadCollaborators()
  }

  // update existing collaborator role
  const updateCollaborator = async (userId: string, roles: WorkspaceUserRoles) => {
    if (!activeWorkspace.value?.id) {
      throw new Error('Workspace not selected')
    }

    await $api.workspaceUser.update(activeWorkspace.value.id!, userId, {
      roles,
    })
    await loadCollaborators()
  }

  // load projects and collaborators list on active workspace change
  watch(
    activeWorkspace,
    async (workspace) => {
      // skip and reset if workspace not selected
      if (!workspace?.id) {
        projects.value = []
        collaborators.value = []
        return
      }

      await Promise.all([loadCollaborators(), loadProjects()])
    },
    { immediate: true },
  )

  // load projects and collaborators list on active workspace change
  watch(
    activePage,
    async (page) => {
      if (page === 'workspace') {
        return
      }
      await loadProjects(page)
    },
    { immediate: true },
  )

  const addToFavourite = async (projectId: string) => {
    try {
      const project = projects.value?.find(({ id }) => id === projectId)
      if (!project) return

      // todo: update the type
      project.starred = true

      await $api.project.userMetaUpdate(projectId, {
        starred: true,
      })
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }
  const removeFromFavourite = async (projectId: string) => {
    try {
      const projectIndex = projects.value?.findIndex(({ id }) => id === projectId)
      if (projectIndex === -1) return

      const project = projects.value![projectIndex!]

      project.starred = false

      // if active page is starred then remove the project from the list
      if (activePage.value === 'starred') {
        projects.value!.splice(projectIndex!, 1)
      }

      await $api.project.userMetaUpdate(projectId, {
        starred: false,
      })
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  const updateProjectTitle = async (project: ProjectType & { edit: boolean; temp_title: string }) => {
    try {
      await $api.project.update(project.id!, { title: project.temp_title })
      project.title = project.temp_title
      project.edit = false
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  const moveWorkspace = async (workspaceId: string, projectId: string) => {
    try {
      await $api.workspaceProject.move(workspaceId, projectId)
      message.success('Project moved successfully')
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  return {
    loadWorkspaceList,
    workspaces,
    createWorkspace,
    deleteWorkspace,
    updateWorkspace,
    activeWorkspace,
    loadProjects,
    loadCollaborators,
    inviteCollaborator,
    removeCollaborator,
    updateCollaborator,
    projects,
    collaborators,
    isWorkspaceCreator,
    isWorkspaceOwner,
    addToFavourite,
    removeFromFavourite,
    activePage,
    updateProjectTitle,
    moveWorkspace,
  }
}, 'workspaceStore')

export { useProvideWorkspaceStore }

export function useWorkspaceStoreOrThrow() {
  const state = useWorkspaceStore()

  if (!state) throw new Error('Please call `useProvideWorkspaceStore` on the appropriate parent component')

  return state
}
