export const useChatPanel = createSharedComposable(() => {
  const isPanelExpanded = ref(false)

  const chatPanelWidth = ref(420)

  const isResizing = ref(false)

  const hasBaseContext = ref(false)

  const startResize = (_e: MouseEvent) => {}

  const toggleChatPanel = () => {}

  return {
    isPanelExpanded,
    chatPanelWidth,
    isResizing,
    hasBaseContext,
    startResize,
    toggleChatPanel,
  }
})
