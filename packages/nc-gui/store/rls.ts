import { acceptHMRUpdate, defineStore } from 'pinia'

export const useRlsStore = defineStore('rls', () => {
  const policies = ref(new Map())

  const isLoading = ref(false)
  const isSaving = ref(false)

  const activePolicies = computed(() => [])

  const loadPolicies = async (..._params: any) => {}
  const createPolicy = async (..._params: any) => null
  const updatePolicy = async (..._params: any) => null
  const deletePolicy = async (..._params: any) => {}
  const setSubjects = async (..._params: any) => null
  const togglePolicy = async (..._params: any) => {}

  return {
    // State
    policies,
    isLoading,
    isSaving,

    // Getters
    activePolicies,

    // Actions
    loadPolicies,
    createPolicy,
    updatePolicy,
    deletePolicy,
    setSubjects,
    togglePolicy,
  }
})

// Enable HMR
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useRlsStore, import.meta.hot))
}
