export const useWorkflowStore = defineStore('workflow', () => {
  const isWorkflowsEnabled = computed(() => false)

  // State
  const workflows = ref(new Map())

  const isLoadingWorkflow = ref(false)

  const activeBaseWorkflows = computed(() => [])

  const activeWorkflowId = computed(() => null)

  const activeWorkflow = computed(() => null)

  // Actions
  const loadWorkflows = async (..._args: any[]) => {}

  const loadWorkflow = async (..._args: any[]) => {}

  const createWorkflow = async (..._args: any[]) => {}

  const updateWorkflow = async (..._args: any[]) => {}

  const deleteWorkflow = async (..._args: any[]) => {}

  const openWorkflow = async (..._args: any[]) => {}

  const duplicateWorkflow = async (..._args: any[]) => {}

  async function openNewWorkflowModal(..._args: any[]) {}

  return {
    // State
    workflows,
    activeWorkflow,
    isLoadingWorkflow,
    isWorkflowsEnabled,

    // Getters
    activeBaseWorkflows,
    activeWorkflowId,

    // Actions
    loadWorkflows,
    loadWorkflow,
    createWorkflow,
    updateWorkflow,
    deleteWorkflow,
    openWorkflow,
    duplicateWorkflow,
    openNewWorkflowModal,
  }
})
