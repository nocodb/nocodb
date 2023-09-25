import { acceptHMRUpdate, defineStore } from 'pinia'
import { MAX_WIDTH_FOR_MOBILE_MODE } from '~/lib'

export const useConfigStore = defineStore('configStore', () => {
  const { isMobileMode: globalIsMobile } = useGlobal()
  const { width } = useWindowSize()

  const sidebarStore = useSidebarStore()
  const viewsStore = useViewsStore()
  const tablesStore = useTablesStore()

  const isViewPortMobile = () => width.value < MAX_WIDTH_FOR_MOBILE_MODE

  const isMobileMode = ref(isViewPortMobile())

  const onViewPortResize = () => {
    isMobileMode.value = isViewPortMobile()
  }

  window.addEventListener('DOMContentLoaded', onViewPortResize)
  window.addEventListener('resize', onViewPortResize)

  watch(
    isMobileMode,
    () => {
      globalIsMobile.value = isMobileMode.value

      // Change --topbar-height css variable
      document.documentElement.style.setProperty('--topbar-height', isMobileMode.value ? '3.25rem' : '3.1rem')

      // Set .mobile-mode class on body
      if (isMobileMode.value) {
        document.body.classList.add('mobile')
        document.body.classList.remove('desktop')
      } else {
        document.body.classList.add('desktop')
        document.body.classList.remove('mobile')
      }
    },
    {
      immediate: true,
    },
  )

  const handleSidebarOpenOnMobileForNonViews = () => {
    if (!isViewPortMobile()) return

    if (!viewsStore.activeViewTitleOrId && !tablesStore.activeTableId) {
      nextTick(() => {
        sidebarStore.isLeftSidebarOpen = true
      })
    } else {
      sidebarStore.isLeftSidebarOpen = false
    }
  }

  watch([viewsStore.activeViewTitleOrId, tablesStore.activeTableId], () => {
    handleSidebarOpenOnMobileForNonViews()
  })

  return {
    isMobileMode,
    isViewPortMobile,
    handleSidebarOpenOnMobileForNonViews,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useConfigStore as any, import.meta.hot))
}
