export interface WorkflowNodesResponse {
  nodes: any[]
}

export function useWorkflowNodes() {
  const workflowNodes = ref<any[]>([])
  const loading = ref(false)
  const error = ref<Error | null>(null)

  const { api } = useApi()
  const { base } = storeToRefs(useBase())

  const loadWorkflowNodes = async () => {
    if (workflowNodes.value.length > 0) {
      // Already loaded
      return
    }

    if (!base.value?.id || !base.value?.fk_workspace_id) {
      console.warn('Workspace or base not available for loading workflow nodes')
      return
    }

    loading.value = true
    error.value = null

    try {
      // Use internal API with workspace and base context
      const response = await api.instance.get<WorkflowNodesResponse>(
        `/api/v2/internal/${base.value?.fk_workspace_id}/${base.value.id}`,
        {
          params: {
            operation: 'workflowNodes',
          },
        },
      )
      workflowNodes.value = response.data.nodes
    } catch (e) {
      error.value = e as Error
      console.error('Failed to load workflow nodes:', e)
    } finally {
      loading.value = false
    }
  }

  const getNodeByKey = (key: string) => {
    return workflowNodes.value.find((n) => n.key === key)
  }

  const getNodesByCategory = (category: string) => {
    return workflowNodes.value.filter((n) => n.category === category)
  }

  return {
    workflowNodes: readonly(workflowNodes),
    loading: readonly(loading),
    error: readonly(error),
    loadWorkflowNodes,
    getNodeByKey,
    getNodesByCategory,
  }
}
