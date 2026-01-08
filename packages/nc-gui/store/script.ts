export const useScriptStore = defineStore('script', () => {
  // State
  const scripts = ref<Map<string, any>>(new Map())
  const activeScript = ref<any | null>(null)
  const isUpdatingScript = ref(false)
  const isLoadingScript = ref(false)

  // Getters
  const activeBaseScripts = computed(() => [])

  const activeScriptId = computed(() => '')

  // Actions
  const loadScripts = async (_parama: any) => {
    return []
  }

  const loadScript = async (_p1: any, _p2: any) => {}

  const createScript = async (_p1: any, _p2: any) => {}

  const updateScript = async (_p1: any, _p2: any, _p3: any) => {}

  const deleteScript = async (_p1: any, _p2: any) => {}

  const openScript = async (_p1: any) => {}

  async function openNewScriptModal(..._arg: any[]) {}

  return {
    // State
    scripts,
    activeScript,
    isUpdatingScript,
    isLoadingScript,

    // Getters
    activeBaseScripts,
    activeScriptId,

    // Actions
    loadScripts,
    loadScript,
    createScript,
    updateScript,
    deleteScript,
    openScript,
    openNewScriptModal,
  }
})
