import { acceptHMRUpdate, defineStore } from 'pinia'
import { INITIAL_LEFT_SIDEBAR_WIDTH, MAX_WIDTH_FOR_MOBILE_MODE } from '~/lib/constants'

export const useSidebarStore = defineStore('sidebarStore', () => {
  const route = useRoute()

  const { width } = useWindowSize()

  const isViewPortMobile = () => {
    return width.value < MAX_WIDTH_FOR_MOBILE_MODE
  }

  const { isMobileMode, leftSidebarSize: _leftSidebarSize, isLeftSidebarOpen: _isLeftSidebarOpen } = useGlobal()

  const miniSidebarWidth = computed(() => {
    return MINI_SIDEBAR_WIDTH
  })

  const isFullScreen = ref(false)

  const tablesStore = useTablesStore()

  const allowHideLeftSidebarForCurrentRoute = computed(() => {
    return ['index-typeOrId-baseId-index-index', 'index-typeOrId-settings'].includes(route.name as string)
  })

  const isLeftSidebarOpen = computed({
    get() {
      if (isMobileMode.value && allowHideLeftSidebarForCurrentRoute.value) {
        return _isLeftSidebarOpen.value
      }

      return (isMobileMode.value && !tablesStore.activeTableId) || _isLeftSidebarOpen.value
    },
    set(value) {
      _isLeftSidebarOpen.value = value
    },
  })

  const isRightSidebarOpen = ref(true)

  const leftSideBarSize = ref({
    old: _leftSidebarSize.value?.old ?? INITIAL_LEFT_SIDEBAR_WIDTH,
    current: isViewPortMobile() ? 0 : _leftSidebarSize.value?.current ?? INITIAL_LEFT_SIDEBAR_WIDTH,
  })

  const leftSidebarWidthPercent = ref((leftSideBarSize.value.current / width.value) * 100)

  const leftSidebarState = ref<
    'openStart' | 'openEnd' | 'hiddenStart' | 'hiddenEnd' | 'peekOpenStart' | 'peekOpenEnd' | 'peekCloseOpen' | 'peekCloseEnd'
  >(isLeftSidebarOpen.value ? 'openEnd' : 'hiddenEnd')

  const mobileNormalizedSidebarSize = computed(() => {
    if (isMobileMode.value) {
      return isLeftSidebarOpen.value ? 100 : 0
    }

    return leftSidebarWidthPercent.value
  })

  const leftSidebarWidth = computed(() => {
    if (isMobileMode.value) {
      return isLeftSidebarOpen.value ? width.value : 0
    }

    return leftSideBarSize.value.current
  })

  const nonHiddenMobileSidebarSize = computed(() => {
    if (isMobileMode.value) {
      return 100
    }

    return leftSideBarSize.value.current || leftSideBarSize.value.old
  })

  const nonHiddenLeftSidebarWidth = computed(() => {
    if (isMobileMode.value) {
      return width.value
    }
    return nonHiddenMobileSidebarSize.value
  })

  const formRightSidebarState = ref({
    minWidth: 384,
    maxWidth: 600,
    width: 384,
  })

  const formRightSidebarWidthPercent = computed(() => {
    return (formRightSidebarState.value.width / (width.value - leftSidebarWidth.value)) * 100
  })

  const hideMiniSidebar = ref(false)

  const hideSidebar = ref(false)

  const showTopbar = ref(false)

  const ncIsIframeFullscreenSupported = ref(false)

  const toggleFullScreenState = () => {
    if (isFullScreen.value) {
      isLeftSidebarOpen.value = true
      if ((!ncIsIframe() || ncIsIframeFullscreenSupported.value) && document?.exitFullscreen && document?.fullscreenElement) {
        document.exitFullscreen().catch((err) => {
          console.warn('Exit fullscreen failed:', err)
        })
      }
    } else {
      isLeftSidebarOpen.value = false

      if ((!ncIsIframe() || ncIsIframeFullscreenSupported.value) && document?.documentElement?.requestFullscreen) {
        document.documentElement.requestFullscreen().catch((err) => {
          console.warn('Request fullscreen failed:', err)
        })
      }
    }

    isFullScreen.value = !isFullScreen.value
  }

  onMounted(() => {
    if (!isViewPortMobile() || tablesStore.activeTableId) return

    _isLeftSidebarOpen.value = true
    leftSidebarState.value = 'openEnd'
  })

  return {
    isLeftSidebarOpen,
    isRightSidebarOpen,
    leftSidebarWidthPercent,
    leftSideBarSize,
    leftSidebarState,
    leftSidebarWidth,
    mobileNormalizedSidebarSize,
    nonHiddenLeftSidebarWidth,
    windowSize: width,
    formRightSidebarState,
    formRightSidebarWidthPercent,
    hideMiniSidebar,
    hideSidebar,
    showTopbar,
    miniSidebarWidth,
    isFullScreen,
    toggleFullScreenState,
    ncIsIframeFullscreenSupported,
    allowHideLeftSidebarForCurrentRoute,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useSidebarStore as any, import.meta.hot))
}
