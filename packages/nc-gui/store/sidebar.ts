import { acceptHMRUpdate, defineStore } from 'pinia'
import { INITIAL_LEFT_SIDEBAR_WIDTH, MAX_WIDTH_FOR_MOBILE_MODE } from '~/lib/constants'

export const useSidebarStore = defineStore('sidebarStore', () => {
  const { width } = useWindowSize()
  const isViewPortMobile = () => {
    return width.value < MAX_WIDTH_FOR_MOBILE_MODE
  }
  const { isMobileMode, leftSidebarSize: _leftSidebarSize } = useGlobal()

  const tablesStore = useTablesStore()
  const _isLeftSidebarOpen = ref(!isViewPortMobile())
  const isLeftSidebarOpen = computed({
    get() {
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

    return leftSideBarSize.value.current ?? leftSideBarSize.value.old
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
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useSidebarStore as any, import.meta.hot))
}
