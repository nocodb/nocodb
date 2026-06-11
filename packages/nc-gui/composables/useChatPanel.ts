export const useChatPanel = createSharedComposable(() => {
  const isPanelExpanded = ref(false)

  const chatPanelWidth = ref(420)

  const isResizing = ref(false)

  const isFullScreen = ref(false)

  const isSidebarOpen = ref(true)

  const hasWorkspaceContext = ref(false)

  const hasBaseContext = ref(false)

  const startResize = (_e: MouseEvent) => {}

  const toggleChatPanel = () => {}

  const toggleFullScreen = () => {}

  const toggleSidebar = () => {}

  return {
    isPanelExpanded,
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
