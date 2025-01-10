export const useAutomationStore = defineStore('automation', () => {
  // State
  const automations = ref<Map<string, any>>(new Map())
  const activeAutomation = ref<any | null>(null)
  const isLoading = ref(false)
  const isLoadingAutomation = ref(false)

  // Getters
  const isAutomationActive = computed(() => false)

  const activeBaseAutomations = computed(() => [])

  const activeAutomationId = computed(() => '')

  // Actions
  const loadAutomations = async (_parama: any) => {
    return []
  }

  const loadAutomation = async (_p1: any, _p2: any) => {}

  const createAutomation = async (_p1: any, _p2: any) => {}

  const updateAutomation = async (_p1: any, _p2: any, _p3: any) => {}

  const deleteAutomation = async (_p1: any, _p2: any) => {}

  const openScript = async (_p1: any) => {}

  return {
    // State
    automations,
    activeAutomation,
    isLoading,
    isLoadingAutomation,

    // Getters
    isAutomationActive,
    activeBaseAutomations,
    activeAutomationId,

    // Actions
    loadAutomations,
    loadAutomation,
    createAutomation,
    updateAutomation,
    deleteAutomation,
    openScript,
  }
})

// Enable HMR
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAutomationStore, import.meta.hot))
}
