import { acceptHMRUpdate, defineStore } from 'pinia'
import { MAX_WIDTH_FOR_MOBILE_MODE } from '~/lib/constants'

export const useConfigStore = defineStore('configStore', () => {
  const router = useRouter()

  const { isMobileMode: globalIsMobile } = useGlobal()
  const { width } = useWindowSize()

  const isViewPortMobile = () => width.value < MAX_WIDTH_FOR_MOBILE_MODE

  // When set to true expanded form will auto focus on comment input and state will be set to false after focussing
  const isExpandedFormCommentMode = ref(false)

  const isMobileMode = ref(isViewPortMobile())

  const projectPageTab = ref<ProjectPageType>('overview')

  const hideSharedBaseBtn = ref(router.currentRoute.value.query.hideSharedBaseBtn === 'true')

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
      document.documentElement.style.setProperty('--topbar-height', isMobileMode.value ? '3.875rem' : '3rem')

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

  return {
    isMobileMode,
    isViewPortMobile,
    projectPageTab,
    isExpandedFormCommentMode,
    hideSharedBaseBtn,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useConfigStore as any, import.meta.hot))
}
