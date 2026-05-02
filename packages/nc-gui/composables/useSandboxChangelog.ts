export const useSandboxChangelog = createSharedComposable(() => {
  const isDrawerOpen = ref(false)
  const isLoading = ref(false)
  const data = ref<{ changelog: any[]; users: Record<string, any> }>({ changelog: [], users: {} })
  const mergeStatus = ref<'idle' | 'loading' | 'success' | 'error'>('idle')
  const mergeError = ref('')
  const DRAWER_WIDTH = 480

  const openDrawer = () => {}
  const closeDrawer = () => {}
  const mergeFromChangelog = async () => {}
  const loadChangelog = async () => {}

  return {
    DRAWER_WIDTH,
    isDrawerOpen,
    isLoading,
    data,
    mergeStatus,
    mergeError,
    openDrawer,
    closeDrawer,
    mergeFromChangelog,
    loadChangelog,
  }
})
