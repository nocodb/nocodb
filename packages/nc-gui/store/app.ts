export const useAppStore = defineStore('app', () => {
  // State
  const apps = ref<Map<string, any>>(new Map())
  const activeApp = ref<any | null>(null)
  const isUpdatingApp = ref(false)
  const isLoadingApp = ref(false)

  // Getters
  const activeBaseApps = computed(() => [])

  const activeAppId = computed(() => '')

  // Actions
  const loadApps = async (_params: any) => {
    return []
  }

  const loadApp = async (_p1: any, _p2: any) => {}

  const createApp = async (_p1: any, _p2: any) => {}

  const updateApp = async (_p1: any, _p2: any, _p3: any) => {}

  const deleteApp = async (_p1: any, _p2: any) => {}

  async function openNewAppModal(..._arg: any[]) {}

  return {
    // State
    apps,
    activeApp,
    isUpdatingApp,
    isLoadingApp,

    // Getters
    activeBaseApps,
    activeAppId,

    // Actions
    loadApps,
    loadApp,
    createApp,
    updateApp,
    deleteApp,
    openNewAppModal,
  }
})
