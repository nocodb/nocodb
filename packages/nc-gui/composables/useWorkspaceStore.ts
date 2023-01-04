import type { ProjectType, WorkspaceType, WorkspaceUserType } from 'nocodb-sdk'
import { WorkspaceUserRoles } from 'nocodb-sdk'
import { message } from 'ant-design-vue'
import { useRoute } from 'vue-router'
import { extractSdkResponseErrorMsg, useInjectionState, useNuxtApp } from '#imports'

const [useProvideWorkspaceStore, useWorkspaceStore] = useInjectionState(() => {
  const workspaces = ref<(WorkspaceType & { edit?: boolean; temp_title?: string })[]>([])

  // const activeWorkspace = ref<WorkspaceType | null>()

  const projects = ref<ProjectType[] | null>()

  const collaborators = ref<WorkspaceUserType[] | null>()

  const route = useRoute()

  const { $api } = useNuxtApp()

  const activeWorkspace = computed(() => {
    return workspaces.value?.find((w) => w.id === route.query.workspaceId) ?? workspaces.value?.[0]
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
      activeWorkspace.value = workspaces.value?.[0]
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  const createWorkspace = async (workspace: Pick<WorkspaceType, 'title' | 'order' | 'description' | 'meta'>) => {
    try {
      // todo: pagination
      await $api.workspace.create(workspace)
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

  const loadProjects = async () => {
    if (!activeWorkspace.value?.id) {
      throw new Error('Workspace not selected')
    }

    const { list } = await $api.workspaceProject.list(activeWorkspace.value?.id)

    projects.value = list
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
  }
}, 'workspaceStore')

export { useProvideWorkspaceStore }

export function useWorkspaceStoreOrThrow() {
  const state = useWorkspaceStore()

  if (!state) throw new Error('Please call `useProvideWorkspaceStore` on the appropriate parent component')

  return state
}
