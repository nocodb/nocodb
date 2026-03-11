import { acceptHMRUpdate, defineStore } from 'pinia'
import { useBreakpoints } from '@vueuse/core'
import { NC_BREAKPOINTS, type NcBreakpoint } from '~/lib/constants'

export const useConfigStore = defineStore('configStore', () => {
  const router = useRouter()

  const { isMobileMode: globalIsMobile, activeBreakpoint: globalActiveBreakpoint } = useGlobal()

  const breakpoints = useBreakpoints(NC_BREAKPOINTS)

  // When set to true expanded form will auto focus on comment input and state will be set to false after focussing
  const isExpandedFormCommentMode = ref(false)

  const isMobileMode = breakpoints.smaller('sm')

  const _activeBp = breakpoints.active()

  const activeBreakpoint = computed<NcBreakpoint>(() => {
    if (isMobileMode.value) return 'xs'
    return (_activeBp.value || 'xs') as NcBreakpoint
  })

  const isViewPortMobile = () => isMobileMode.value

  const projectPageTab = ref<ProjectPageType>('overview')

  const hideSharedBaseBtn = ref(router.currentRoute.value.query.hideSharedBaseBtn === 'true')

  watch(
    activeBreakpoint,
    (bp) => {
      globalIsMobile.value = isMobileMode.value
      globalActiveBreakpoint.value = bp

      // Change --topbar-height css variable
      document.documentElement.style.setProperty('--topbar-height', bp === 'xs' ? '3.875rem' : '3rem')

      // Set body class for CSS selectors
      document.body.classList.remove('mobile', 'tablet', 'desktop')
      if (bp === 'xs') {
        document.body.classList.add('mobile')
      } else if (bp === 'sm') {
        document.body.classList.add('tablet')
      } else {
        document.body.classList.add('desktop')
      }
    },
    {
      immediate: true,
    },
  )

  return {
    isMobileMode,
    activeBreakpoint,
    isViewPortMobile,
    projectPageTab,
    isExpandedFormCommentMode,
    hideSharedBaseBtn,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useConfigStore as any, import.meta.hot))
}
