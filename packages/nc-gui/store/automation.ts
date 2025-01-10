import { acceptHMRUpdate } from 'pinia'

export const useAutomation = defineStore('automationStore', () => {
  const isAutomationActive = computed(() => false)

  const isAutomationsLoading = ref()
  const isLoadingAutomation = ref()

  const baseAutomations = ref<any>(new Map())

  const activeBaseAutomations = computed(() => [])

  const activeAutomationId = computed(() => '')

  const activeAutomation = ref()

  const loadAutomations = async (_param: any) => []

  const loadAutomation = async (_param1, _param2) => {}

  const openScript = async (_param: any) => {}

  return {
    loadAutomations,
    isAutomationsLoading,
    baseAutomations,
    isAutomationActive,
    activeBaseAutomations,
    activeAutomation,
    activeAutomationId,
    loadAutomation,
    isLoadingAutomation,
    openScript,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAutomation as any, import.meta.hot))
}
