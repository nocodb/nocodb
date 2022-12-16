import type { ProjectType, WorkspaceType, WorkspaceUserRoles, WorkspaceUserType } from 'nocodb-sdk'
import { message } from 'ant-design-vue'
import { extractSdkResponseErrorMsg, useInjectionState, useNuxtApp } from '#imports'

const [useProvideWorkspaceStore, useWorkspaceStore] = useInjectionState(() => {
  const workspaces = ref<WorkspaceType[]>([])

  const activeWorkspace = ref<WorkspaceType | null>()

  const projects = ref<ProjectType[] | null>()

  const collaborators = ref<WorkspaceUserType[] | null>()

  const { $api } = useNuxtApp()

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
      const res = await $api.workspace.create(workspace)
      console.log(res)
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
      const res = await $api.workspace.update(workspaceId, workspace)
      console.log(res)
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  const deleteWorkspace = async (workspaceId: string) => {
    try {
      // todo: pagination
      const res = await $api.workspace.delete(workspaceId)
      console.log(res)
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  const loadProjects = () => {}

  const loadCollaborators = async (params?: { offset?: number; limit?: number }) => {
    if (!activeWorkspace.value?.id) {
      throw new Error('Workspace not selected')
    }

    // todo: pagination
    const { list, pageInfo: _ } = await $api.workspaceUser.list(activeWorkspace.value.id!, { query: params })

    collaborators.value = list
  }

  // invite new user to the workspace
  const inviteCollaborator = async (email: string, role: WorkspaceUserRoles) => {
    if (!activeWorkspace.value?.id) {
      throw new Error('Workspace not selected')
    }

    await $api.workspaceUser.invite(activeWorkspace.value.id!, {
      email,
      role,
    })
  }

  // remove user from workspace
  const removeCollaborator = async (userId: string) => {
    if (!activeWorkspace.value?.id) {
      throw new Error('Workspace not selected')
    }

    await $api.workspaceUser.delete(activeWorkspace.value.id!, userId)
  }

  // update existing collaborator role
  const updateCollaborator = async (userId: string, role: WorkspaceUserRoles) => {
    if (!activeWorkspace.value?.id) {
      throw new Error('Workspace not selected')
    }

    await $api.workspaceUser.update(activeWorkspace.value.id!, userId, {
      role,
    })
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
  }
})

export { useProvideWorkspaceStore }

export function useWorkspaceStoreOrThrow() {
  const state = useWorkspaceStore()

  if (!state) throw new Error('Please call `useProvideWorkspaceStore` on the appropriate parent component')

  return state
}
