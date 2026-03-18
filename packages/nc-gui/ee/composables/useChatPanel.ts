export const useChatPanel = createSharedComposable(() => {
  const { isPanelExpanded: isExtensionPanelExpanded } = useExtensions()
  const { isPanelExpanded: isActionPanelExpanded } = useActionPane()

  const workspaceStore = useWorkspace()
  const { activeWorkspaceId } = storeToRefs(workspaceStore)

  const basesStore = useBases()
  const { activeProjectId: activeBaseId } = storeToRefs(basesStore)

  const { isEEFeatureBlocked } = useEeConfig()

  const { $e } = useNuxtApp()

  const panelPreference = useLocalStorage('nc-chat-panel-expanded', false)

  const isFullScreen = ref(false)

  const isSidebarOpen = ref(true)

  const hasWorkspaceContext = computed(() => !!activeWorkspaceId.value)

  const hasBaseContext = computed(() => !!activeBaseId.value)

  const isPanelExpanded = computed({
    get: () => panelPreference.value && hasWorkspaceContext.value && hasBaseContext.value && !isEEFeatureBlocked.value,
    set: (val: boolean) => {
      panelPreference.value = val
      if (!val) isFullScreen.value = false
    },
  })

  const MIN_WIDTH = 320
  const MAX_WIDTH = 720
  const DEFAULT_WIDTH = 420

  const chatPanelWidth = useLocalStorage('nc-chat-panel-width', DEFAULT_WIDTH)

  const isResizing = ref(false)

  const toggleFullScreen = () => {
    isFullScreen.value = !isFullScreen.value
    $e(isFullScreen.value ? 'c:chat:fullscreen:open' : 'c:chat:fullscreen:close')
  }

  const toggleSidebar = () => {
    isSidebarOpen.value = !isSidebarOpen.value
  }

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
    $e(isPanelExpanded.value ? 'c:chat:open' : 'c:chat:close')
  }

  watch(
    [isEEFeatureBlocked, isExtensionPanelExpanded, isActionPanelExpanded, hasBaseContext],
    ([blocked, ext, act, hasBase]) => {
      if ((blocked || ext || act || !hasBase) && panelPreference.value) {
        panelPreference.value = false
      }
    },
    { immediate: true },
  )

  // Expose chat panel width as CSS variable for viewport-based layouts
  watchEffect(() => {
    document.documentElement.style.setProperty(
      '--nc-chat-panel-offset',
      isPanelExpanded.value && !isFullScreen.value ? `${chatPanelWidth.value}px` : '0px',
    )
  })

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
