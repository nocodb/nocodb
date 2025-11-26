import type { DashboardType, WorkflowType } from 'nocodb-sdk'

export function useDependencies() {
  const { api } = useApi()

  const status = ref<'loading' | 'error' | 'done'>('loading')

  const { activeWorkspaceId } = storeToRefs(useWorkspace())

  const { activeProjectId } = storeToRefs(useBases())

  const dependency = ref<{
    hasBreakingChanges: boolean
    dashboards: Array<DashboardType>
    workflows: Array<WorkflowType>
  }>({
    hasBreakingChanges: false,
    dashboards: [],
    workflows: [],
  })

  const checkDependency = async (entityType: DependencyTableType, entityId: string) => {
    if (!activeWorkspaceId.value || !activeProjectId.value) {
      return
    }
    try {
      status.value = 'loading'
      dependency.value = await api.internal.postOperation(
        activeWorkspaceId.value,
        activeProjectId.value,
        {
          operation: 'checkDependency',
        },
        {
          entityType,
          entityId,
        },
      )

      status.value = 'done'
    } catch (e) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsgv2(e as any))
      status.value = 'error'
    }
  }

  return {
    status,
    dependency,
    checkDependency,
  }
}
