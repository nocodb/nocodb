export const useChatPanel = createSharedComposable(() => {
  const { isPanelExpanded: isExtensionPanelExpanded } = useExtensions()
  const { isPanelExpanded: isActionPanelExpanded } = useActionPane()

  const isPanelExpanded = ref(false)

  const chatPanelSize = ref(35)

  const toggleChatPanel = () => {
    if (isExtensionPanelExpanded.value) {
      isExtensionPanelExpanded.value = false
    }
    if (isActionPanelExpanded.value) {
      isActionPanelExpanded.value = false
    }
    isPanelExpanded.value = !isPanelExpanded.value
  }

  // Close chat panel when other panels open
  watch(isExtensionPanelExpanded, (newValue) => {
    if (newValue && isPanelExpanded.value) {
      isPanelExpanded.value = false
    }
  })

  watch(isActionPanelExpanded, (newValue) => {
    if (newValue && isPanelExpanded.value) {
      isPanelExpanded.value = false
    }
  })

  return {
    isPanelExpanded,
    chatPanelSize,
    toggleChatPanel,
  }
})
