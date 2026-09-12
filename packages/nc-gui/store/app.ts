export const useAppStore = defineStore('app', () => {
  // State
  const apps = ref<Map<string, any>>(new Map())
  const installedApps = ref<any[]>([])
  const activeApp = ref<any | null>(null)
  const isUpdatingApp = ref(false)
  const isLoadingApp = ref(false)

  // Getters
  // Apps is EE-only AND behind the `apps` advanced experimental flag, so the CE
  // gate is a constant false — see the EE store for the real one.
  const isAppsEnabled = computed(() => false)

  const activeBaseApps = computed(() => [])

  const activeAppId = computed(() => '')

  // Actions
  const loadApps = async (_params: any) => {
    return []
  }

  const loadInstalledApps = async (_force?: boolean) => {
    return []
  }

  const openAppLive = async (_p1: any, _p2?: any) => {
    return { url: '' }
  }

  const loadApp = async (_p1: any, _p2: any) => {}

  const createApp = async (_p1: any, _p2: any) => {}

  const updateApp = async (_p1: any, _p2: any, _p3: any) => {}

  async function openNewAppModal(..._arg: any[]) {}

  return {
    // Gate
    isAppsEnabled,

    // State
    apps,
    installedApps,
    activeApp,
    isUpdatingApp,
    isLoadingApp,

    // Getters
    activeBaseApps,
    activeAppId,

    // Actions
    loadApps,
    loadInstalledApps,
    openAppLive,
    loadApp,
    createApp,
    updateApp,
    openNewAppModal,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAppStore, import.meta.hot))
}
