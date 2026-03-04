export const useChatPanel = createSharedComposable(() => {
  const { isPanelExpanded: isExtensionPanelExpanded } = useExtensions()
  const { isPanelExpanded: isActionPanelExpanded } = useActionPane()

  const workspaceStore = useWorkspace()
  const { activeWorkspaceId } = storeToRefs(workspaceStore)

  const { $e } = useNuxtApp()

  // User preference persisted across sessions
  const panelPreference = useLocalStorage('nc-chat-panel-expanded', false)

  const hasWorkspaceContext = computed(() => !!activeWorkspaceId.value)

  const isPanelExpanded = computed({
    get: () => panelPreference.value && hasWorkspaceContext.value,
    set: (val: boolean) => {
      panelPreference.value = val
    },
  })

  const MIN_WIDTH = 320
  const MAX_WIDTH = 720
  const DEFAULT_WIDTH = 420

  const chatPanelWidth = useLocalStorage('nc-chat-panel-width', DEFAULT_WIDTH)

  const isResizing = ref(false)

  const startResize = (e: MouseEvent) => {
    e.preventDefault()
    isResizing.value = true

    const startX = e.clientX
    const startWidth = chatPanelWidth.value

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = startX - moveEvent.clientX
      chatPanelWidth.value = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + delta))
    }

    const onMouseUp = () => {
      isResizing.value = false
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  const toggleChatPanel = () => {
    if (isExtensionPanelExpanded.value) {
      isExtensionPanelExpanded.value = false
    }
    if (isActionPanelExpanded.value) {
      isActionPanelExpanded.value = false
    }
    isPanelExpanded.value = !isPanelExpanded.value
    if (isPanelExpanded.value) {
      $e('c:chat:open')
    }
  }

  // Expose chat panel width as a CSS variable so viewport-based layouts can account for it
  watchEffect(() => {
    document.documentElement.style.setProperty(
      '--nc-chat-panel-offset',
      isPanelExpanded.value ? `${chatPanelWidth.value}px` : '0px',
    )
  })

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
    chatPanelWidth,
    isResizing,
    hasWorkspaceContext,
    startResize,
    toggleChatPanel,
  }
})
