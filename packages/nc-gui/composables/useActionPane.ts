export const useActionPane = createSharedComposable(() => {
  const isViewActionsEnabled = computed(() => false)

  const isRowActionsEnabled = computed(() => false)

  const actionPanelSize = ref(40)
  const isPanelExpanded = ref(false)

  const toggleActionPanel = () => {}

  const openActionPane = () => {}

  const addScriptExecution = (..._args: any) => {}

  const removeScriptExecution = (..._args: any) => {}

  const clearAllExecutions = () => {}

  const executions = computed(() => [])

  return {
    isPanelExpanded,
    actionPanelSize,
    toggleActionPanel,
    openActionPane,
    addScriptExecution,
    removeScriptExecution,
    clearAllExecutions,
    executions,
    isViewActionsEnabled,
    isRowActionsEnabled,
  }
})
