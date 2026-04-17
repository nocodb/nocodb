import { acceptHMRUpdate, defineStore } from 'pinia'
import { INITIAL_LEFT_SIDEBAR_WIDTH, MINI_SIDEBAR_WIDTH, NC_BREAKPOINTS, NEW_MINI_SIDEBAR_WIDTH } from '~/lib/constants'

export const useSidebarStore = defineStore('sidebarStore', () => {
  const router = useRouter()
  const route = router.currentRoute

  const { width } = useWindowSize()

  const isViewPortMobile = () => {
    return width.value < NC_BREAKPOINTS.sm
  }

  const { isMobileMode, leftSidebarSize: _leftSidebarSize, isLeftSidebarOpen: _isLeftSidebarOpen } = useGlobal()

  const miniSidebarWidth = computed(() => {
    if (isMobileMode.value) return MINI_SIDEBAR_WIDTH
    return width.value >= 1280 ? NEW_MINI_SIDEBAR_WIDTH : MINI_SIDEBAR_WIDTH
  })

  const isFullScreen = ref(false)

  const tablesStore = useTablesStore()

  const viewsStore = useViewsStore()
  const { activeViewTitleOrId } = storeToRefs(viewsStore)

  const allowHideLeftSidebarForCurrentRoute = computed(() => {
    return (
      [
        'index-typeOrId-baseId-index-index',
        'index-typeOrId-settings-page',
        'index-typeOrId-baseId-index-settings-page',
        'index-typeOrId-baseId-index-docs',
        'index-typeOrId-baseId-index-docs-docId-slugs',
      ].includes(route.value.name as string) || isWsHomeRoute(route.value)
    )
  })

  const isLeftSidebarOpen = computed({
    get() {
      if (isMobileMode.value && allowHideLeftSidebarForCurrentRoute.value) {
        return _isLeftSidebarOpen.value
      }

      return (isMobileMode.value && !activeViewTitleOrId.value) || _isLeftSidebarOpen.value
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

  const isBaseSettingsFullPage = ref(false)

  const showTopbar = ref(false)

  type SidebarTab = 'data' | 'workflows' | 'agents' | 'settings'

  const activeSidebarTab = ref<SidebarTab>('data')

  /** Derive the correct sidebar tab from the current route name. */
  const routeDerivedTab = computed<SidebarTab | null>(() => {
    const name = route.value.name?.toString() ?? ''

    // Workspace-level settings (old and new flat routes)
    if (wsSettingsRouteNames.has(name)) return 'settings'

    // Base routes — only derive tab when a baseId is present
    if (name.startsWith('index-typeOrId-baseId-')) {
      if (name.startsWith('index-typeOrId-baseId-index-settings')) return 'settings'

      if (
        name.startsWith('index-typeOrId-baseId-index-workflows') ||
        name.startsWith('index-typeOrId-baseId-index-automation-') ||
        name.startsWith('index-typeOrId-baseId-index-scripts') ||
        name.startsWith('index-typeOrId-baseId-index-automations')
      ) {
        return 'workflows'
      }

      // All other routes resolve to data tab (table, dashboard, document, etc.)
      return 'data'
    }

    return null
  })

  watch(
    routeDerivedTab,
    (newTab) => {
      if (newTab !== null && activeSidebarTab.value !== newTab) {
        activeSidebarTab.value = newTab
      }
    },
    {
      immediate: true,
    },
  )

  const toggleFullScreenState = () => {
    if (isFullScreen.value) {
      isLeftSidebarOpen.value = true
      if (!ncIsIframe() && document?.exitFullscreen && document?.fullscreenElement) {
        document.exitFullscreen().catch((err) => {
          console.warn('Exit fullscreen failed:', err)
        })
      }
    } else {
      isLeftSidebarOpen.value = false

      if (!ncIsIframe() && document?.documentElement?.requestFullscreen) {
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
    isBaseSettingsFullPage,
    showTopbar,
    miniSidebarWidth,
    isFullScreen,
    toggleFullScreenState,
    allowHideLeftSidebarForCurrentRoute,
    activeSidebarTab,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useSidebarStore as any, import.meta.hot))
}
