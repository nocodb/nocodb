import { NO_SCOPE } from 'nocodb-sdk'

interface InstanceAdminStats {
  totalWorkspaces: number
  totalBases: number
  totalUsers: number
  editorCount: number
}

interface InstanceAdminWorkspace {
  id: string
  title: string
  meta: Record<string, any>
  memberCount: number
  baseCount: number
}

interface InstanceAdminBase {
  id: string
  title: string
  meta: Record<string, any>
  workspace_id: string
  workspace_title: string
  workspace_meta: Record<string, any>
  memberCount: number
}

export const useInstanceAdmin = createSharedComposable(() => {
  const { $api } = useNuxtApp()

  const stats = ref<InstanceAdminStats>({
    totalWorkspaces: 0,
    totalBases: 0,
    totalUsers: 0,
    editorCount: 0,
  })

  const workspaces = ref<InstanceAdminWorkspace[]>([])

  const bases = ref<InstanceAdminBase[]>([])

  const isLoading = ref(false)

  async function fetchStats() {
    try {
      isLoading.value = true
      const result = (await $api.internal.getOperation(NO_SCOPE, NO_SCOPE, {
        operation: 'instanceAdminStats',
      })) as InstanceAdminStats

      stats.value = result
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    } finally {
      isLoading.value = false
    }
  }

  async function fetchWorkspaces() {
    try {
      isLoading.value = true
      const result = (await $api.internal.getOperation(NO_SCOPE, NO_SCOPE, {
        operation: 'instanceAdminWorkspaces',
      })) as InstanceAdminWorkspace[]

      workspaces.value = result
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    } finally {
      isLoading.value = false
    }
  }

  async function fetchBases() {
    try {
      isLoading.value = true
      const result = (await $api.internal.getOperation(NO_SCOPE, NO_SCOPE, {
        operation: 'instanceAdminBases',
      })) as InstanceAdminBase[]

      bases.value = result
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    } finally {
      isLoading.value = false
    }
  }

  return { stats, workspaces, bases, isLoading, fetchStats, fetchWorkspaces, fetchBases }
})
