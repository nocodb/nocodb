export const useDashboardStore = defineStore('dashboard', () => {
  // State
  const dashboards = ref(new Map())
  const isEditingDashboard = ref(false)

  const activeBaseDashboards = computed(() => [])

  const activeDashboardId = computed(() => null)

  const activeDashboard = computed(() => null)

  const isDashboardEnabled = computed(() => false)

  const loadDashboards = async (..._params: any) => []

  const loadDashboard = async (..._params: any) => null

  const createDashboard = async (..._params: any) => null

  const updateDashboard = async (..._params: any) => null

  const deleteDashboard = async (..._params: any) => true

  const openDashboard = async (..._params: any) => null

  const duplicateDashboard = async (..._params: any) => null

  async function openNewDashboardModal(..._params: any) {}

  return {
    // State
    dashboards,
    activeDashboard,
    isEditingDashboard,
    isDashboardEnabled,

    // Getters
    activeBaseDashboards,
    activeDashboardId,

    // Actions
    loadDashboards,
    loadDashboard,
    createDashboard,
    updateDashboard,
    deleteDashboard,
    openDashboard,
    duplicateDashboard,
    openNewDashboardModal,
  }
})

// Enable HMR
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useDashboardStore, import.meta.hot))
}
