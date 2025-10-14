export const useWidgetStore = defineStore('widget', () => {
  const widgets = ref(new Map())

  const activeDashboardWidgets = computed(() => [])

  const selectedWidget = ref(null)

  const loadWidgets = async (_params: any) => []

  const getWidget = async (_params: any) => null

  const createWidget = async (..._params: any) => null

  const updateWidget = async (..._params: any) => null

  const duplicateWidget = async (..._params: any) => null

  const deleteWidget = async (..._params: any) => true

  const updateWidgetPosition = async (..._params: any) => null

  const clearWidgets = (..._params: any) => null

  const loadWidgetData = async (..._params: any) => null

  return {
    // State
    widgets,

    // Getters
    activeDashboardWidgets,
    selectedWidget,

    // Actions
    loadWidgets,
    getWidget,
    createWidget,
    duplicateWidget,
    updateWidget,
    deleteWidget,
    updateWidgetPosition,
    clearWidgets,
    loadWidgetData,
  }
})

// Enable HMR
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useWidgetStore, import.meta.hot))
}
