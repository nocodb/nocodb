export const useChatPanel = createSharedComposable(() => {
  const isPanelExpanded = ref(false)

  const chatPanelSize = ref(35)

  const toggleChatPanel = () => {}

  return {
    isPanelExpanded,
    chatPanelSize,
    toggleChatPanel,
  }
})
