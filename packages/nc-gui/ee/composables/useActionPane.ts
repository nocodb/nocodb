export const useActionPane = createSharedComposable(() => {
  const { isPanelExpanded: isExtensionPanelExpanded } = useExtensions()
  const { activeExecutions } = useScriptExecutor()

  const { isFeatureEnabled } = useBetaFeatureToggle()

  const isViewActionsEnabled = computed(() => {
    return isFeatureEnabled(FEATURE_FLAG.VIEW_ACTIONS)
  })

  const actionPanelSize = ref(40)
  const isPanelExpanded = ref(false)

  const executionMetadata = ref(
    new Map<
      string,
      {
        recordId: string
        displayValue: string
        scriptId: string
        scriptName: string
        buttonFieldName?: string
        startTime: Date
      }
    >(),
  )

  const toggleActionPanel = () => {
    if (isExtensionPanelExpanded.value) {
      isExtensionPanelExpanded.value = false
    }
    isPanelExpanded.value = !isPanelExpanded.value
  }

  const openActionPane = () => {
    if (isExtensionPanelExpanded.value) {
      isExtensionPanelExpanded.value = false
    }
    isPanelExpanded.value = true
  }

  const addScriptExecution = (
    executionId: string,
    metadata: {
      recordId: string
      displayValue: string
      scriptId: string
      scriptName: string
      buttonFieldName?: string
    },
    enableActionPane = true,
  ) => {
    executionMetadata.value.set(executionId, {
      ...metadata,
      startTime: new Date(),
    })

    if (enableActionPane) {
      openActionPane()
    }
  }

  const removeScriptExecution = (executionId: string) => {
    executionMetadata.value.delete(executionId)
  }

  const clearAllExecutions = () => {
    executionMetadata.value.clear()
  }

  const executions = computed(() => {
    const executionsList: Array<{
      executionId: string
      recordId: string
      displayValue: string
      scriptId: string
      scriptName: string
      buttonFieldName?: string
      playground: any[]
      status: 'running' | 'completed' | 'error' | 'finished'
      startTime: Date
    }> = []

    executionMetadata.value.forEach((metadata, executionId) => {
      const execution = activeExecutions.value.get(executionId)
      if (execution) {
        executionsList.push({
          executionId,
          ...metadata,
          playground: execution.playground || [],
          status: execution.status === 'finished' ? 'completed' : execution.status || 'running',
        })
      }
    })

    return executionsList.sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
  })

  watch(isExtensionPanelExpanded, (newValue) => {
    if (newValue && isPanelExpanded.value) {
      isPanelExpanded.value = false
    }
  })

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
  }
})
