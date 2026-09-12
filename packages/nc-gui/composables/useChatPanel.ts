export const useChatPanel = createSharedComposable(() => {
  const isPanelExpanded = ref(false)

  const isPanelLocked = ref(false)

  const onboardingBuildBaseId = ref<string | null>(null)

  const chatPanelWidth = ref(420)

  const isResizing = ref(false)

  const isFullScreen = ref(false)

  const isSidebarOpen = ref(true)

  const hasWorkspaceContext = ref(false)

  const hasBaseContext = ref(false)

  const openPanelQuery: Record<string, string> = {}

  const startResize = (_e: MouseEvent) => {}

  const toggleChatPanel = () => {}

  const toggleFullScreen = () => {}

  const toggleSidebar = () => {}

  return {
    openPanelQuery,
    isPanelExpanded,
    isPanelLocked,
    onboardingBuildBaseId,
    chatPanelWidth,
    isResizing,
    isFullScreen,
    isSidebarOpen,
    hasWorkspaceContext,
    hasBaseContext,
    startResize,
    toggleChatPanel,
    toggleFullScreen,
    toggleSidebar,
  }
})
