export const useAgentStore = defineStore('agent', () => {
  // State
  const agents = ref(new Map())

  const isLoadingAgent = ref(false)

  const activeAgent = computed(() => null)

  const activeBaseAgents = computed(() => [])

  const activeAgentId = computed(() => null)

  const isAgentsEnabled = computed(() => false)

  // Actions
  const loadAgents = async (..._args: any[]) => {}

  const loadAgent = async (..._args: any[]) => {}

  const createAgent = async (..._args: any[]) => {}

  const updateAgent = async (..._args: any[]) => {}

  const deleteAgent = async (..._args: any[]) => {}

  const openAgent = async (..._args: any[]) => {}

  async function openNewAgentModal(..._args: any[]) {}

  return {
    // State
    agents,
    activeAgent,
    isLoadingAgent,

    // Getters
    activeBaseAgents,
    activeAgentId,
    isAgentsEnabled,

    // Actions
    loadAgents,
    loadAgent,
    createAgent,
    updateAgent,
    deleteAgent,
    openAgent,
    openNewAgentModal,
  }
})

// Enable HMR
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAgentStore as any, import.meta.hot))
}
