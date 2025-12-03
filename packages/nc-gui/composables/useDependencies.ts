import type { DashboardType, DependencyTableType, WorkflowType } from 'nocodb-sdk'

export function useDependencies() {
  const { api } = useApi()

  const status = ref<'loading' | 'error' | 'done'>('loading')

  const { activeWorkspaceId } = storeToRefs(useWorkspace())

  const { activeProjectId } = storeToRefs(useBases())

  const dependency = ref<{
    hasBreakingChanges: boolean
    entities: Array<{
      type: DependencyTableType
      entity: DashboardType | WorkflowType
    }>
  }>({
    hasBreakingChanges: false,
    entities: [],
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
