export interface WorkflowNodesResponse {
  nodes: any[]
}

export function useWorkflowNodes() {
  const workflowNodes = ref<any[]>([])
  const loading = ref(false)
  const error = ref<Error | null>(null)

  const { api } = useApi()

  const loadWorkflowNodes = async () => {
    if (workflowNodes.value.length > 0) {
      // Already loaded
      return
    }

    loading.value = true
    error.value = null

    try {
      // Direct API call since SDK doesn't have this endpoint yet
      const response = await api.instance.get<WorkflowNodesResponse>('/api/v2/workflow-nodes')
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
