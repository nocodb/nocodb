export const useBaseVariablesStore = defineStore('baseVariables', () => {
  // State
  const variables = ref(new Map())
  const isLoading = ref(false)

  // Getters
  const activeBaseVariables = computed(() => [])

  const unconfiguredRequiredVars = computed(() => [])

  const hasUnconfiguredVars = computed(() => false)

  // Actions
  const loadVariables = async (..._params: any) => []

  const createVariable = async (..._params: any) => undefined

  const updateVariable = async (..._params: any) => undefined

  const deleteVariable = async (..._params: any) => undefined

  const revertToDefault = async (..._params: any) => undefined

  const bulkUpdateValues = async (..._params: any) => undefined

  const setEnvValue = async (..._params: any) => false

  const deleteEnvValue = async (..._params: any) => false

  return {
    // State
    variables,
    isLoading,

    // Getters
    activeBaseVariables,
    unconfiguredRequiredVars,
    hasUnconfiguredVars,

    // Actions
    loadVariables,
    createVariable,
    updateVariable,
    deleteVariable,
    revertToDefault,
    bulkUpdateValues,
    setEnvValue,
    deleteEnvValue,
  }
})

// Enable HMR
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useBaseVariablesStore, import.meta.hot))
}
