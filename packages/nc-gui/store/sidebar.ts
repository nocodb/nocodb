import { acceptHMRUpdate, defineStore } from 'pinia'
import { MAX_WIDTH_FOR_MOBILE_MODE } from '~/lib'

export const useSidebarStore = defineStore('sidebarStore', () => {
  const { width } = useWindowSize()
  const isViewPortMobile = () => {
    return width.value < MAX_WIDTH_FOR_MOBILE_MODE
  }
  const { isMobileMode } = useGlobal()

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

  const leftSidebarWidthPercent = ref(isViewPortMobile() ? 0 : 20)

  const leftSideBarSize = ref({
    old: 20,
    current: leftSidebarWidthPercent.value,
  })

  const leftSidebarState = ref<
    'openStart' | 'openEnd' | 'hiddenStart' | 'hiddenEnd' | 'peekOpenStart' | 'peekOpenEnd' | 'peekCloseOpen' | 'peekCloseEnd'
  >(isLeftSidebarOpen.value ? 'openEnd' : 'hiddenEnd')

  const mobileNormalizedSidebarSize = computed(() => {
    if (isMobileMode.value) {
      return isLeftSidebarOpen.value ? 100 : 0
    }

    return leftSideBarSize.value.current
  })

  const leftSidebarWidth = computed(() => (width.value * mobileNormalizedSidebarSize.value) / 100)

  return {
    isLeftSidebarOpen,
    isRightSidebarOpen,
    leftSidebarWidthPercent,
    leftSideBarSize,
    leftSidebarState,
    leftSidebarWidth,
    mobileNormalizedSidebarSize,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useSidebarStore as any, import.meta.hot))
}
