import { acceptHMRUpdate, defineStore } from 'pinia'
import { MAX_WIDTH_FOR_MOBILE_MODE, MAX_WIDTH_FOR_TABLET_MODE } from '~/lib/constants'

export const useConfigStore = defineStore('configStore', () => {
  const router = useRouter()

  const { isMobileMode: globalIsMobile, isTabletMode: globalIsTablet } = useGlobal()
  const { width } = useWindowSize()

  const isViewPortMobile = () => width.value < MAX_WIDTH_FOR_MOBILE_MODE

  const isViewPortTablet = () => !isViewPortMobile() && width.value < MAX_WIDTH_FOR_TABLET_MODE

  // When set to true expanded form will auto focus on comment input and state will be set to false after focussing
  const isExpandedFormCommentMode = ref(false)

  const isMobileMode = ref(isViewPortMobile())

  const isTabletMode = ref(isViewPortTablet())

  const projectPageTab = ref<ProjectPageType>('overview')

  const hideSharedBaseBtn = ref(router.currentRoute.value.query.hideSharedBaseBtn === 'true')

  const onViewPortResize = () => {
    isMobileMode.value = isViewPortMobile()
    isTabletMode.value = isViewPortTablet()
  }

  window.addEventListener('DOMContentLoaded', onViewPortResize)
  window.addEventListener('resize', onViewPortResize)

  watch(
    isMobileMode,
    () => {
      globalIsMobile.value = isMobileMode.value
      globalIsTablet.value = isTabletMode.value

      // Change --topbar-height css variable
      document.documentElement.style.setProperty('--topbar-height', isMobileMode.value ? '3.875rem' : '3rem')

      // Set .mobile-mode class on body
      if (isMobileMode.value) {
        document.body.classList.add('mobile')
        document.body.classList.remove('desktop', 'tablet')
      } else if (isTabletMode.value) {
        document.body.classList.add('tablet')
        document.body.classList.remove('mobile', 'desktop')
      } else {
        document.body.classList.add('desktop')
        document.body.classList.remove('mobile', 'tablet')
      }
    },
    {
      immediate: true,
    },
  )

  watch(
    isTabletMode,
    () => {
      globalIsTablet.value = isTabletMode.value

      if (isMobileMode.value) {
        document.body.classList.add('mobile')
        document.body.classList.remove('desktop', 'tablet')
      } else if (isTabletMode.value) {
        document.body.classList.add('tablet')
        document.body.classList.remove('mobile', 'desktop')
      } else {
        document.body.classList.add('desktop')
        document.body.classList.remove('mobile', 'tablet')
      }
    },
    {
      immediate: true,
    },
  )

  return {
    isMobileMode,
    isTabletMode,
    isViewPortMobile,
    isViewPortTablet,
    projectPageTab,
    isExpandedFormCommentMode,
    hideSharedBaseBtn,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useConfigStore as any, import.meta.hot))
}
